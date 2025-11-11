import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { algorandTransaction, roastingData } from '../src/lib/server/db/schema';
import algosdk from 'algosdk';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create database connection for script
if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const client = createClient({
	url: process.env.DATABASE_URL,
	authToken: process.env.DATABASE_AUTH_TOKEN
});

const db = drizzle(client);

// AlgoNode indexer for fetching child transactions
const INDEXER_SERVER = 'https://mainnet-idx.algonode.cloud';
const indexerClient = new algosdk.Indexer('', INDEXER_SERVER, '');

interface WalletInfo {
	address: string;
	role: Set<string>; // 'tracked', 'sender', 'receiver', 'child_sender', 'child_receiver'
	transactionCount: number;
	firstSeen?: Date;
	lastSeen?: Date;
}

/**
 * Discovers all wallet addresses involved in the Lavazza transaction network
 */
async function discoverWallets() {
	console.log('🔍 Starting wallet discovery...\n');

	const wallets = new Map<string, WalletInfo>();

	// Helper to add/update wallet info
	function addWallet(address: string, role: string, timestamp?: Date) {
		if (!address) return;

		if (!wallets.has(address)) {
			wallets.set(address, {
				address,
				role: new Set([role]),
				transactionCount: 0,
				firstSeen: timestamp,
				lastSeen: timestamp
			});
		} else {
			const wallet = wallets.get(address)!;
			wallet.role.add(role);
			if (timestamp) {
				if (!wallet.firstSeen || timestamp < wallet.firstSeen) {
					wallet.firstSeen = timestamp;
				}
				if (!wallet.lastSeen || timestamp > wallet.lastSeen) {
					wallet.lastSeen = timestamp;
				}
			}
		}
	}

	// Step 1: Get all tracked addresses (the ones we're actively syncing)
	console.log('📊 Step 1: Getting tracked addresses...');
	const trackedAddresses = await db
		.selectDistinct({ address: algorandTransaction.address })
		.from(algorandTransaction);

	trackedAddresses.forEach((row) => {
		addWallet(row.address, 'tracked');
		console.log(`  ✓ Tracked: ${row.address}`);
	});

	// Step 2: Get all senders and receivers from existing transactions
	console.log('\n📊 Step 2: Analyzing transaction senders and receivers...');
	const transactions = await db
		.select({
			sender: algorandTransaction.sender,
			receiver: algorandTransaction.receiver,
			timestamp: algorandTransaction.timestamp,
			address: algorandTransaction.address
		})
		.from(algorandTransaction);

	console.log(`  Found ${transactions.length} transactions to analyze`);

	transactions.forEach((tx) => {
		if (tx.sender) {
			addWallet(tx.sender, 'sender', tx.timestamp);
			const wallet = wallets.get(tx.sender);
			if (wallet) wallet.transactionCount++;
		}
		if (tx.receiver) {
			addWallet(tx.receiver, 'receiver', tx.timestamp);
		}
	});

	// Step 3: Get all child transaction IDs
	console.log('\n📊 Step 3: Discovering child transactions...');
	const childTxData = await db
		.selectDistinct({ childTx: roastingData.childTx })
		.from(roastingData)
		.where(sql`${roastingData.childTx} IS NOT NULL`);

	console.log(`  Found ${childTxData.length} unique child transaction references`);

	// Step 4: Fetch child transaction details from blockchain
	console.log('\n📊 Step 4: Fetching child transaction details from blockchain...');
	let childTxFetched = 0;
	let childTxErrors = 0;

	for (const { childTx } of childTxData) {
		if (!childTx) continue;

		try {
			// Fetch the transaction from the blockchain
			const response = await indexerClient.lookupTransactionByID(childTx).do();
			const tx = response.transaction;

			if (tx) {
				const timestamp = tx['round-time'] ? new Date(tx['round-time'] * 1000) : undefined;

				if (tx.sender) {
					addWallet(tx.sender, 'child_sender', timestamp);
					console.log(`  ✓ Child TX ${childTx}: sender ${tx.sender}`);
				}

				const receiver =
					tx['payment-transaction']?.receiver || tx.paymentTransaction?.receiver;
				if (receiver) {
					addWallet(receiver, 'child_receiver', timestamp);
					console.log(`  ✓ Child TX ${childTx}: receiver ${receiver}`);
				}

				childTxFetched++;
			}

			// Rate limiting - wait 100ms between requests
			await new Promise((resolve) => setTimeout(resolve, 100));
		} catch (error) {
			console.log(`  ✗ Error fetching child TX ${childTx}:`, error);
			childTxErrors++;
		}
	}

	console.log(`  Fetched ${childTxFetched} child transactions (${childTxErrors} errors)`);

	// Step 5: Generate report
	console.log('\n' + '='.repeat(80));
	console.log('📋 WALLET DISCOVERY REPORT');
	console.log('='.repeat(80) + '\n');

	const walletArray = Array.from(wallets.values()).sort((a, b) => {
		// Sort by transaction count descending
		return b.transactionCount - a.transactionCount;
	});

	console.log(`Total unique wallets discovered: ${walletArray.length}\n`);

	// Group by role
	const byRole = {
		tracked: walletArray.filter((w) => w.role.has('tracked')),
		senders: walletArray.filter((w) => w.role.has('sender') || w.role.has('child_sender')),
		receivers: walletArray.filter((w) => w.role.has('receiver') || w.role.has('child_receiver')),
		childOnly: walletArray.filter(
			(w) =>
				(w.role.has('child_sender') || w.role.has('child_receiver')) &&
				!w.role.has('tracked') &&
				!w.role.has('sender') &&
				!w.role.has('receiver')
		)
	};

	console.log('Wallets by Role:');
	console.log(`  Tracked addresses (actively syncing): ${byRole.tracked.length}`);
	console.log(`  Transaction senders: ${byRole.senders.length}`);
	console.log(`  Transaction receivers: ${byRole.receivers.length}`);
	console.log(`  Found only in child transactions: ${byRole.childOnly.length}\n`);

	// Detailed wallet list
	console.log('Detailed Wallet List:');
	console.log('-'.repeat(80));

	walletArray.forEach((wallet, index) => {
		const roles = Array.from(wallet.role).join(', ');
		console.log(`${index + 1}. ${wallet.address}`);
		console.log(`   Roles: ${roles}`);
		console.log(`   Transaction count: ${wallet.transactionCount}`);
		if (wallet.firstSeen) {
			console.log(`   First seen: ${wallet.firstSeen.toISOString()}`);
		}
		if (wallet.lastSeen) {
			console.log(`   Last seen: ${wallet.lastSeen.toISOString()}`);
		}
		console.log('');
	});

	// Recommendations
	console.log('='.repeat(80));
	console.log('💡 RECOMMENDATIONS');
	console.log('='.repeat(80) + '\n');

	if (byRole.childOnly.length > 0) {
		console.log('New wallet addresses found in child transactions:');
		byRole.childOnly.forEach((wallet) => {
			console.log(`  - ${wallet.address}`);
		});
		console.log(
			"\nConsider adding these addresses to LAVAZZA_ADDRESSES if they're part of the supply chain.\n"
		);
	}

	// Find high-activity senders that aren't tracked
	const untrackedSenders = walletArray.filter(
		(w) =>
			(w.role.has('sender') || w.role.has('child_sender')) &&
			!w.role.has('tracked') &&
			w.transactionCount > 5
	);

	if (untrackedSenders.length > 0) {
		console.log('High-activity sender addresses not currently tracked:');
		untrackedSenders.forEach((wallet) => {
			console.log(`  - ${wallet.address} (${wallet.transactionCount} transactions)`);
		});
		console.log('\nThese may be worth tracking if they are part of the Lavazza supply chain.\n');
	}

	console.log('Discovery complete! ✨');
}

// Run the discovery
discoverWallets()
	.then(() => {
		client.close();
		process.exit(0);
	})
	.catch((error) => {
		console.error('Error during wallet discovery:', error);
		client.close();
		process.exit(1);
	});
