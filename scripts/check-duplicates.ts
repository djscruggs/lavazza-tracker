#!/usr/bin/env tsx
/**
 * Check for Duplicate Records
 *
 * Checks if there are duplicate records in the database
 */

import { db } from '../src/lib/server/db/cli';
import { algorandTransaction, roastingData, processingData } from '../src/lib/server/db/schema';
import { sql, count } from 'drizzle-orm';

async function main() {
	console.log('\n' + '='.repeat(80));
	console.log('CHECKING FOR DUPLICATE RECORDS');
	console.log('='.repeat(80));

	// Check for duplicate roasting_data records
	console.log('\n--- Roasting Data Duplicates ---');
	const allRoasting = await db.select().from(roastingData);
	const roastingByTxId = new Map<string, number>();

	for (const record of allRoasting) {
		const count = roastingByTxId.get(record.transactionId) || 0;
		roastingByTxId.set(record.transactionId, count + 1);
	}

	const roastingDupes = Array.from(roastingByTxId.entries()).filter(([_, count]) => count > 1);
	if (roastingDupes.length > 0) {
		console.log(`Found ${roastingDupes.length} transactions with duplicate roasting_data records:`);
		for (const [txId, count] of roastingDupes.slice(0, 10)) {
			console.log(`  Transaction ${txId}: ${count} records`);
		}
		if (roastingDupes.length > 10) {
			console.log(`  ... and ${roastingDupes.length - 10} more`);
		}
	} else {
		console.log('✓ No duplicates found in roasting_data');
	}

	// Check for duplicate processing_data records
	console.log('\n--- Processing Data Duplicates ---');
	const allProcessing = await db.select().from(processingData);
	const processingByTxId = new Map<string, number>();

	for (const record of allProcessing) {
		const count = processingByTxId.get(record.transactionId) || 0;
		processingByTxId.set(record.transactionId, count + 1);
	}

	const processingDupes = Array.from(processingByTxId.entries()).filter(([_, count]) => count > 1);
	if (processingDupes.length > 0) {
		console.log(`Found ${processingDupes.length} transactions with duplicate processing_data records:`);
		for (const [txId, count] of processingDupes.slice(0, 10)) {
			console.log(`  Transaction ${txId}: ${count} records`);
		}
		if (processingDupes.length > 10) {
			console.log(`  ... and ${processingDupes.length - 10} more`);
		}
	} else {
		console.log('✓ No duplicates found in processing_data');
	}

	// Check for duplicate algorand_transaction records
	console.log('\n--- Algorand Transaction Duplicates ---');
	const allTxs = await db.select().from(algorandTransaction);
	const txByTxId = new Map<string, number>();

	for (const record of allTxs) {
		const count = txByTxId.get(record.txId) || 0;
		txByTxId.set(record.txId, count + 1);
	}

	const txDupes = Array.from(txByTxId.entries()).filter(([_, count]) => count > 1);
	if (txDupes.length > 0) {
		console.log(`Found ${txDupes.length} duplicate transactions:`);
		for (const [txId, count] of txDupes.slice(0, 10)) {
			console.log(`  Transaction ${txId}: ${count} records`);
		}
		if (txDupes.length > 10) {
			console.log(`  ... and ${txDupes.length - 10} more`);
		}
	} else {
		console.log('✓ No duplicates found in algorand_transaction');
	}

	console.log('\n' + '='.repeat(80));
	process.exit(0);
}

main().catch(error => {
	console.error('\nError:', error);
	process.exit(1);
});
