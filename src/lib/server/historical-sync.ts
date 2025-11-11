import algosdk from 'algosdk';
import { db } from './db';
import { algorandTransaction, roastingData, syncStatus } from './db/schema';
import { eq } from 'drizzle-orm';
import { LAVAZZA_ADDRESS, parseRoastingData } from './algorand';

// AlgoNode free indexer endpoints
const INDEXER_SERVER = 'https://mainnet-idx.algonode.cloud';
const INDEXER_PORT = '';
const INDEXER_TOKEN = '';

const indexerClient = new algosdk.Indexer(INDEXER_TOKEN, INDEXER_SERVER, INDEXER_PORT);

interface HistoricalSyncResult {
	success: boolean;
	totalTransactions: number;
	pagesProcessed: number;
	error?: string;
}

/**
 * Fetches ALL historical transactions for the Lavazza address using pagination
 * This should be run once to backfill the database with historical data
 */
export async function syncHistoricalTransactions(
	batchSize = 100,
	delayBetweenBatches = 100
): Promise<HistoricalSyncResult> {
	console.log('[HISTORICAL SYNC] Starting historical sync for address:', LAVAZZA_ADDRESS);
	console.log(`[HISTORICAL SYNC] Batch size: ${batchSize}, Delay: ${delayBetweenBatches}ms`);

	let totalTransactions = 0;
	let pagesProcessed = 0;
	let nextToken: string | undefined = undefined;
	let hasMore = true;

	try {
		while (hasMore) {
			console.log(`[HISTORICAL SYNC] Fetching page ${pagesProcessed + 1}...`);

			// Build query with pagination
			let query = indexerClient
				.lookupAccountTransactions(LAVAZZA_ADDRESS)
				.limit(batchSize);

			if (nextToken) {
				query = query.nextToken(nextToken);
			}

			// Fetch the page
			const response = await query.do();
			const transactions = response.transactions || [];

			console.log(`[HISTORICAL SYNC] Page ${pagesProcessed + 1}: Found ${transactions.length} transactions`);

			// Process each transaction
			for (const tx of transactions) {
				try {
					// Decode note if present (tx.note is a Uint8Array, not a string)
					const noteDecoded =
						tx.note && tx.note.length > 0 ? new TextDecoder().decode(tx.note) : undefined;

					// Convert note to base64 string for storage
					const noteRaw =
						tx.note && tx.note.length > 0 ? Buffer.from(tx.note).toString('base64') : undefined;

					// Save transaction to database
					const savedTx = await saveTransaction({
						txId: tx.id || '',
						address: LAVAZZA_ADDRESS,
						round: Number(tx.confirmedRound || 0),
						timestamp: new Date((tx.roundTime || 0) * 1000),
						noteRaw: noteRaw,
						noteDecoded: noteDecoded,
						sender: tx.sender,
						receiver: (tx as any).paymentTransaction?.receiver,
						amount: (tx as any).paymentTransaction?.amount
							? Number((tx as any).paymentTransaction.amount)
							: undefined,
						fee: Number(tx.fee || 0),
						txType: (tx as any).txType || 'unknown',
						rawJson: JSON.stringify(tx, (_key, value) =>
							typeof value === 'bigint' ? value.toString() : value
						)
					});

					// Parse and save roasting data if note exists
					if (noteDecoded && tx.id) {
						const parsed = parseRoastingData(noteDecoded);
						if (parsed) {
							await saveRoastingData(savedTx.id, tx.id, noteDecoded, parsed);
						}
					}

					totalTransactions++;
				} catch (error) {
					console.error(`[HISTORICAL SYNC] Error processing transaction ${tx.id}:`, error);
					// Continue processing other transactions
				}
			}

			pagesProcessed++;

			// Check if there are more pages
			nextToken = response.nextToken;
			hasMore = !!nextToken && transactions.length > 0;

			if (hasMore) {
				console.log(`[HISTORICAL SYNC] More pages available, waiting ${delayBetweenBatches}ms...`);
				await sleep(delayBetweenBatches);
			}
		}

		// Update sync status with the highest round processed
		if (totalTransactions > 0) {
			const latestTx = await db
				.select()
				.from(algorandTransaction)
				.where(eq(algorandTransaction.address, LAVAZZA_ADDRESS))
				.orderBy(algorandTransaction.round)
				.limit(1);

			if (latestTx.length > 0) {
				await updateSyncStatus(LAVAZZA_ADDRESS, latestTx[0].round);
			}
		}

		console.log('[HISTORICAL SYNC] Complete!');
		console.log(`[HISTORICAL SYNC] Total transactions: ${totalTransactions}`);
		console.log(`[HISTORICAL SYNC] Pages processed: ${pagesProcessed}`);

		return {
			success: true,
			totalTransactions,
			pagesProcessed
		};
	} catch (error) {
		console.error('[HISTORICAL SYNC] Error during historical sync:', error);
		return {
			success: false,
			totalTransactions,
			pagesProcessed,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Saves a transaction to the database
 */
async function saveTransaction(tx: {
	txId: string;
	address: string;
	round: number;
	timestamp: Date;
	noteRaw?: string;
	noteDecoded?: string;
	sender?: string;
	receiver?: string;
	amount?: number;
	fee?: number;
	txType?: string;
	rawJson: string;
}): Promise<{ id: string }> {
	const result = await db
		.insert(algorandTransaction)
		.values(tx)
		.onConflictDoNothing() // Skip if transaction already exists
		.returning({ id: algorandTransaction.id });

	// If conflict, fetch existing transaction
	if (result.length === 0) {
		const existing = await db
			.select({ id: algorandTransaction.id })
			.from(algorandTransaction)
			.where(eq(algorandTransaction.txId, tx.txId))
			.limit(1);

		return existing[0];
	}

	return result[0];
}

/**
 * Saves parsed roasting data to the database
 */
async function saveRoastingData(
	transactionId: string,
	txId: string,
	rawNote: string,
	parsed: ReturnType<typeof parseRoastingData>
): Promise<void> {
	if (!parsed) return;

	await db
		.insert(roastingData)
		.values({
			transactionId: transactionId,
			txId: txId,
			parentCompanyId: parsed.parentCompanyId,
			productionBatchId: parsed.productionBatchId,
			typeOfRoast: parsed.typeOfRoast,
			locationOfRoastingPlant: parsed.locationOfRoastingPlant,
			kgCoffeeRoasted: parsed.kgCoffeeRoasted,
			roastDate: parsed.roastDate,
			zone1CoffeeSpecies: parsed.zone1CoffeeSpecies,
			zone1HarvestBegin: parsed.zone1HarvestBegin,
			zone1HarvestEnd: parsed.zone1HarvestEnd,
			zone2CoffeeSpecies: parsed.zone2CoffeeSpecies,
			zone2HarvestBegin: parsed.zone2HarvestBegin,
			zone2HarvestEnd: parsed.zone2HarvestEnd,
			childTx: parsed.childTx,
			rawData: rawNote
		})
		.onConflictDoNothing();
}

/**
 * Updates the sync status for an address
 */
async function updateSyncStatus(address: string, lastProcessedRound?: number): Promise<void> {
	const existing = await db
		.select()
		.from(syncStatus)
		.where(eq(syncStatus.address, address))
		.limit(1);

	if (existing.length === 0) {
		// Create new sync status
		await db.insert(syncStatus).values({
			address: address,
			lastProcessedRound: lastProcessedRound,
			lastSyncedAt: new Date(),
			createdAt: new Date()
		});
	} else {
		// Update existing sync status
		await db
			.update(syncStatus)
			.set({
				lastProcessedRound: lastProcessedRound,
				lastSyncedAt: new Date()
			})
			.where(eq(syncStatus.address, address));
	}
}

/**
 * Helper function to sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
