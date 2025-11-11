import { db } from './db';
import { algorandTransaction, roastingData, syncStatus } from './db/schema';
import { eq } from 'drizzle-orm';
import {
	LAVAZZA_ADDRESSES,
	fetchNewTransactions,
	parseRoastingData,
	type AlgorandTransaction
} from './algorand';

/**
 * Syncs new Algorand transactions for all Lavazza addresses
 * This function should be called periodically (e.g., hourly)
 */
export async function syncLavazzaTransactions(): Promise<{
	success: boolean;
	transactionsProcessed: number;
	addressesProcessed: number;
	error?: string;
}> {
	let totalProcessed = 0;
	let addressesProcessed = 0;
	const errors: string[] = [];

	// Sync all configured addresses
	for (const address of LAVAZZA_ADDRESSES) {
		try {
			const result = await syncAddressTransactions(address);
			totalProcessed += result.transactionsProcessed;
			addressesProcessed++;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[SYNC] Error syncing address ${address}:`, errorMsg);
			errors.push(`${address}: ${errorMsg}`);
		}
	}

	if (errors.length > 0 && errors.length === LAVAZZA_ADDRESSES.length) {
		// All addresses failed
		return {
			success: false,
			transactionsProcessed: totalProcessed,
			addressesProcessed,
			error: `All addresses failed: ${errors.join('; ')}`
		};
	}

	return {
		success: true,
		transactionsProcessed: totalProcessed,
		addressesProcessed
	};
}

/**
 * Syncs new Algorand transactions for a specific address
 */
async function syncAddressTransactions(address: string): Promise<{
	success: boolean;
	transactionsProcessed: number;
	error?: string;
}> {
	try {
		console.log(`[SYNC] Starting sync for address: ${address}`);

		// Get the last sync status
		const lastSync = await db
			.select()
			.from(syncStatus)
			.where(eq(syncStatus.address, address))
			.limit(1);

		const lastProcessedRound = lastSync[0]?.lastProcessedRound ?? undefined;
		console.log(`[SYNC] Last processed round: ${lastProcessedRound || 'none'}`);

		// Fetch new transactions
		const transactions = await fetchNewTransactions(address, lastProcessedRound);
		console.log(`[SYNC] Found ${transactions.length} new transactions`);

		if (transactions.length === 0) {
			// Update sync status even if no new transactions
			await updateSyncStatus(address, lastProcessedRound);
			return { success: true, transactionsProcessed: 0 };
		}

		// Process each transaction
		let processedCount = 0;
		let highestRound = lastProcessedRound || 0;

		for (const tx of transactions) {
			try {
				// Save transaction to database
				const savedTx = await saveTransaction(tx, address);

				// Parse and save roasting data if note exists
				if (tx.noteDecoded) {
					const parsed = parseRoastingData(tx.noteDecoded);
					if (parsed) {
						await saveRoastingData(savedTx.id, tx.id, tx.noteDecoded, parsed);
					}
				}

				// Track highest round
				if (tx.round > highestRound) {
					highestRound = tx.round;
				}

				processedCount++;
			} catch (error) {
				console.error(`[SYNC] Error processing transaction ${tx.id}:`, error);
				// Continue processing other transactions
			}
		}

		// Update sync status with highest round processed
		await updateSyncStatus(address, highestRound);

		console.log(
			`[SYNC] Successfully processed ${processedCount}/${transactions.length} transactions for ${address}`
		);

		return {
			success: true,
			transactionsProcessed: processedCount
		};
	} catch (error) {
		console.error('[SYNC] Error during sync:', error);
		return {
			success: false,
			transactionsProcessed: 0,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Saves a transaction to the database
 */
async function saveTransaction(
	tx: AlgorandTransaction,
	address: string
): Promise<{ id: string }> {
	const result = await db
		.insert(algorandTransaction)
		.values({
			txId: tx.id,
			address: address,
			round: tx.round,
			timestamp: new Date(tx.timestamp * 1000), // Convert Unix timestamp to Date
			noteRaw: tx.note,
			noteDecoded: tx.noteDecoded,
			sender: tx.sender,
			receiver: tx.receiver,
			amount: tx.amount,
			fee: tx.fee,
			txType: tx.txType,
			rawJson: JSON.stringify(tx)
		})
		.onConflictDoNothing() // Skip if transaction already exists
		.returning({ id: algorandTransaction.id });

	// If conflict, fetch existing transaction
	if (result.length === 0) {
		const existing = await db
			.select({ id: algorandTransaction.id })
			.from(algorandTransaction)
			.where(eq(algorandTransaction.txId, tx.id))
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
