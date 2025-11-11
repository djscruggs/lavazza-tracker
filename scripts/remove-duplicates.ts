#!/usr/bin/env tsx
/**
 * Remove Duplicate Records Script
 *
 * Removes duplicate roasting_data and processing_data records,
 * keeping only the most recent record for each transaction
 */

import { db } from '../src/lib/server/db/cli';
import { roastingData, processingData } from '../src/lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
	console.log('\n' + '='.repeat(80));
	console.log('REMOVING DUPLICATE RECORDS');
	console.log('='.repeat(80));

	// Remove duplicate roasting_data records
	console.log('\n--- Removing Roasting Data Duplicates ---');
	const allRoasting = await db.select().from(roastingData);
	const roastingByTxId = new Map<string, typeof allRoasting>();

	// Group by transaction_id
	for (const record of allRoasting) {
		if (!roastingByTxId.has(record.transactionId)) {
			roastingByTxId.set(record.transactionId, []);
		}
		roastingByTxId.get(record.transactionId)!.push(record);
	}

	let roastingDeleted = 0;
	for (const [transactionId, records] of roastingByTxId.entries()) {
		if (records.length > 1) {
			// Sort by created_at descending (most recent first)
			records.sort((a, b) => {
				const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return bTime - aTime;
			});

			// Keep the first (most recent), delete the rest
			const toKeep = records[0];
			const toDelete = records.slice(1);

			for (const record of toDelete) {
				await db.delete(roastingData).where(eq(roastingData.id, record.id));
				roastingDeleted++;
			}

			if (roastingDeleted % 50 === 0) {
				console.log(`  Deleted ${roastingDeleted} duplicate roasting_data records...`);
			}
		}
	}

	console.log(`✓ Deleted ${roastingDeleted} duplicate roasting_data records`);

	// Remove duplicate processing_data records
	console.log('\n--- Removing Processing Data Duplicates ---');
	const allProcessing = await db.select().from(processingData);
	const processingByTxId = new Map<string, typeof allProcessing>();

	// Group by transaction_id
	for (const record of allProcessing) {
		if (!processingByTxId.has(record.transactionId)) {
			processingByTxId.set(record.transactionId, []);
		}
		processingByTxId.get(record.transactionId)!.push(record);
	}

	let processingDeleted = 0;
	for (const [transactionId, records] of processingByTxId.entries()) {
		if (records.length > 1) {
			// Sort by created_at descending (most recent first)
			records.sort((a, b) => {
				const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return bTime - aTime;
			});

			// Keep the first (most recent), delete the rest
			const toKeep = records[0];
			const toDelete = records.slice(1);

			for (const record of toDelete) {
				await db.delete(processingData).where(eq(processingData.id, record.id));
				processingDeleted++;
			}

			if (processingDeleted % 50 === 0) {
				console.log(`  Deleted ${processingDeleted} duplicate processing_data records...`);
			}
		}
	}

	console.log(`✓ Deleted ${processingDeleted} duplicate processing_data records`);

	console.log('\n' + '='.repeat(80));
	console.log('CLEANUP COMPLETE');
	console.log('='.repeat(80));
	console.log(`Total duplicates removed: ${roastingDeleted + processingDeleted}`);
	console.log('='.repeat(80));

	process.exit(0);
}

main().catch(error => {
	console.error('\nError:', error);
	process.exit(1);
});
