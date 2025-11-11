#!/usr/bin/env tsx
/**
 * Re-parse Existing Transactions Script
 *
 * Re-parses all existing transactions with the improved parser
 * to extract data that was missed in the initial sync.
 *
 * Usage:
 *   npm run reparse
 */

import { db } from '../src/lib/server/db/cli';
import { algorandTransaction, roastingData, processingData } from '../src/lib/server/db/schema';
import { parseRoastingData, parseProcessingData } from '../src/lib/server/algorand';
import { eq } from 'drizzle-orm';

async function main() {
	console.log('='.repeat(60));
	console.log('RE-PARSE TRANSACTIONS');
	console.log('='.repeat(60));
	console.log('');
	console.log('This script will re-parse all existing transactions');
	console.log('with the improved parser to extract missing data.');
	console.log('');
	console.log('='.repeat(60));
	console.log('');

	try {
		// Get all transactions
		const transactions = await db.select().from(algorandTransaction);

		console.log(`Found ${transactions.length} transactions to process`);
		console.log('');

		let updatedCount = 0;
		let skippedCount = 0;
		let failedCount = 0;

		for (const tx of transactions) {
			try {
				// Skip if no note
				if (!tx.noteDecoded) {
					skippedCount++;
					continue;
				}

				// Parse the note
				const parsed = parseRoastingData(tx.noteDecoded);

				if (!parsed) {
					console.log(`[SKIP] No data in note for tx ${tx.txId}`);
					skippedCount++;
					continue;
				}

				// Check if roasting data already exists
				const existing = await db
					.select()
					.from(roastingData)
					.where(eq(roastingData.transactionId, tx.id))
					.limit(1);

				if (existing.length > 0) {
					// Update existing record
					await db
						.update(roastingData)
						.set({
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
							rawData: tx.noteDecoded
						})
						.where(eq(roastingData.transactionId, tx.id));

					console.log(`[UPDATE] Updated roasting data for tx ${tx.txId}`);
				} else {
					// Insert new record
					await db.insert(roastingData).values({
						transactionId: tx.id,
						txId: tx.txId,
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
						rawData: tx.noteDecoded
					});

					console.log(`[INSERT] Created roasting data for tx ${tx.txId}`);
				}

				// Also try parsing as processing data
				const processingParsed = parseProcessingData(tx.noteDecoded);
				if (processingParsed) {
					// Check if processing data already exists
					const existingProcessing = await db
						.select()
						.from(processingData)
						.where(eq(processingData.transactionId, tx.id))
						.limit(1);

					if (existingProcessing.length > 0) {
						// Update existing record
						await db
							.update(processingData)
							.set({
								receptionIds: processingParsed.receptionIds,
								postHullIds: processingParsed.postHullIds,
								sizeOfBeans: processingParsed.sizeOfBeans,
								qtyGreenCoffee: processingParsed.qtyGreenCoffee,
								sortEntry: processingParsed.sortEntry,
								sortExit: processingParsed.sortExit,
								harvestBegin: processingParsed.harvestBegin,
								harvestEnd: processingParsed.harvestEnd,
								rawData: tx.noteDecoded
							})
							.where(eq(processingData.transactionId, tx.id));

						console.log(`[UPDATE] Updated processing data for tx ${tx.txId}`);
					} else {
						// Insert new record
						await db.insert(processingData).values({
							transactionId: tx.id,
							txId: tx.txId,
							receptionIds: processingParsed.receptionIds,
							postHullIds: processingParsed.postHullIds,
							sizeOfBeans: processingParsed.sizeOfBeans,
							qtyGreenCoffee: processingParsed.qtyGreenCoffee,
							sortEntry: processingParsed.sortEntry,
							sortExit: processingParsed.sortExit,
							harvestBegin: processingParsed.harvestBegin,
							harvestEnd: processingParsed.harvestEnd,
							rawData: tx.noteDecoded
						});

						console.log(`[INSERT] Created processing data for tx ${tx.txId}`);
					}
				}

				updatedCount++;
			} catch (error) {
				console.error(`[ERROR] Failed to process tx ${tx.txId}:`, error);
				failedCount++;
			}
		}

		console.log('');
		console.log('='.repeat(60));
		console.log('RE-PARSE COMPLETE');
		console.log('='.repeat(60));
		console.log(`Total Transactions: ${transactions.length}`);
		console.log(`Updated: ${updatedCount}`);
		console.log(`Skipped: ${skippedCount}`);
		console.log(`Failed: ${failedCount}`);
		console.log('='.repeat(60));

		process.exit(0);
	} catch (error) {
		console.error('');
		console.error('='.repeat(60));
		console.error('FATAL ERROR');
		console.error('='.repeat(60));
		console.error(error);
		console.error('='.repeat(60));
		process.exit(1);
	}
}

main();
