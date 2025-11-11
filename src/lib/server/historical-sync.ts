import algosdk from 'algosdk';
import { db } from './db';
import { algorandTransaction, roastingData, processingData, harvestData, syncStatus } from './db/schema';
import { eq } from 'drizzle-orm';
import { LAVAZZA_ADDRESSES, parseRoastingData, parseProcessingData, parseHarvestData } from './algorand';

// AlgoNode free indexer endpoints
const INDEXER_SERVER = 'https://mainnet-idx.algonode.cloud';
const INDEXER_PORT = '';
const INDEXER_TOKEN = '';

const indexerClient = new algosdk.Indexer(INDEXER_TOKEN, INDEXER_SERVER, INDEXER_PORT);

interface HistoricalSyncResult {
	success: boolean;
	totalTransactions: number;
	pagesProcessed: number;
	addressesProcessed: number;
	error?: string;
}

/**
 * Fetches ALL historical transactions for all Lavazza addresses using pagination
 * This should be run once to backfill the database with historical data
 */
export async function syncHistoricalTransactions(
	batchSize = 100,
	delayBetweenBatches = 100
): Promise<HistoricalSyncResult> {
	console.log('[HISTORICAL SYNC] Starting historical sync for all addresses');
	console.log(`[HISTORICAL SYNC] Addresses: ${LAVAZZA_ADDRESSES.join(', ')}`);
	console.log(`[HISTORICAL SYNC] Batch size: ${batchSize}, Delay: ${delayBetweenBatches}ms`);

	let totalTransactions = 0;
	let totalPagesProcessed = 0;
	let addressesProcessed = 0;
	const errors: string[] = [];

	// Sync each address
	for (const address of LAVAZZA_ADDRESSES) {
		try {
			const result = await syncHistoricalTransactionsForAddress(
				address,
				batchSize,
				delayBetweenBatches
			);
			totalTransactions += result.totalTransactions;
			totalPagesProcessed += result.pagesProcessed;
			addressesProcessed++;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[HISTORICAL SYNC] Error syncing address ${address}:`, errorMsg);
			errors.push(`${address}: ${errorMsg}`);
		}
	}

	if (errors.length > 0 && errors.length === LAVAZZA_ADDRESSES.length) {
		// All addresses failed
		return {
			success: false,
			totalTransactions,
			pagesProcessed: totalPagesProcessed,
			addressesProcessed,
			error: `All addresses failed: ${errors.join('; ')}`
		};
	}

	console.log('[HISTORICAL SYNC] All addresses complete!');
	console.log(`[HISTORICAL SYNC] Total transactions: ${totalTransactions}`);
	console.log(`[HISTORICAL SYNC] Total pages processed: ${totalPagesProcessed}`);
	console.log(`[HISTORICAL SYNC] Addresses processed: ${addressesProcessed}/${LAVAZZA_ADDRESSES.length}`);

	return {
		success: true,
		totalTransactions,
		pagesProcessed: totalPagesProcessed,
		addressesProcessed
	};
}

/**
 * Fetches ALL historical transactions for a specific address using pagination
 */
async function syncHistoricalTransactionsForAddress(
	address: string,
	batchSize: number,
	delayBetweenBatches: number
): Promise<{ totalTransactions: number; pagesProcessed: number }> {
	console.log(`[HISTORICAL SYNC] Starting historical sync for address: ${address}`);

	let totalTransactions = 0;
	let pagesProcessed = 0;
	let nextToken: string | undefined = undefined;
	let hasMore = true;

	while (hasMore) {
		console.log(`[HISTORICAL SYNC] [${address}] Fetching page ${pagesProcessed + 1}...`);

		// Build query with pagination
		let query = indexerClient.lookupAccountTransactions(address).limit(batchSize);

		if (nextToken) {
			query = query.nextToken(nextToken);
		}

		// Fetch the page
		const response = await query.do();
		const transactions = response.transactions || [];

		console.log(
			`[HISTORICAL SYNC] [${address}] Page ${pagesProcessed + 1}: Found ${transactions.length} transactions`
		);

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
					address: address,
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

					// Also try parsing as processing data
					const processingParsed = parseProcessingData(noteDecoded);
					if (processingParsed) {
						await saveProcessingData(savedTx.id, tx.id, noteDecoded, processingParsed);
					}

					// Also try parsing as harvest data
					const harvestParsed = parseHarvestData(noteDecoded);
					if (harvestParsed) {
						await saveHarvestData(savedTx.id, tx.id, noteDecoded, harvestParsed);
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
			console.log(
				`[HISTORICAL SYNC] [${address}] More pages available, waiting ${delayBetweenBatches}ms...`
			);
			await sleep(delayBetweenBatches);
		}
	}

	// Update sync status with the highest round processed
	if (totalTransactions > 0) {
		const latestTx = await db
			.select()
			.from(algorandTransaction)
			.where(eq(algorandTransaction.address, address))
			.orderBy(algorandTransaction.round)
			.limit(1);

		if (latestTx.length > 0) {
			await updateSyncStatus(address, latestTx[0].round);
		}
	}

	console.log(`[HISTORICAL SYNC] [${address}] Complete!`);
	console.log(`[HISTORICAL SYNC] [${address}] Total transactions: ${totalTransactions}`);
	console.log(`[HISTORICAL SYNC] [${address}] Pages processed: ${pagesProcessed}`);

	return {
		totalTransactions,
		pagesProcessed
	};
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
 * Saves parsed processing data to the database
 */
async function saveProcessingData(
	transactionId: string,
	txId: string,
	rawNote: string,
	parsed: ReturnType<typeof parseProcessingData>
): Promise<void> {
	if (!parsed) return;

	await db
		.insert(processingData)
		.values({
			transactionId: transactionId,
			txId: txId,
			receptionIds: parsed.receptionIds,
			postHullIds: parsed.postHullIds,
			sizeOfBeans: parsed.sizeOfBeans,
			qtyGreenCoffee: parsed.qtyGreenCoffee,
			sortEntry: parsed.sortEntry,
			sortExit: parsed.sortExit,
			harvestBegin: parsed.harvestBegin,
			harvestEnd: parsed.harvestEnd,
			rawData: rawNote
		})
		.onConflictDoNothing();
}

/**
 * Saves parsed harvest data to the database
 */
async function saveHarvestData(
	transactionId: string,
	txId: string,
	rawNote: string,
	parsed: ReturnType<typeof parseHarvestData>
): Promise<void> {
	if (!parsed) return;

	await db
		.insert(harvestData)
		.values({
			transactionId: transactionId,
			txId: txId,
			farmId: parsed.farmId,
			farmAnagraphic: parsed.farmAnagraphic,
			farmLocation: parsed.farmLocation,
			fieldsData: JSON.stringify(parsed.fields),
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
