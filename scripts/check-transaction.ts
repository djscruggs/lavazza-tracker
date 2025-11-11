#!/usr/bin/env tsx
/**
 * Check Transaction Script
 *
 * Checks if a transaction exists in the database and displays its parsed data
 */

import { db } from '../src/lib/server/db/cli';
import { algorandTransaction, roastingData, processingData } from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
	const txId = process.argv[2] || 'B5P5QRLLDTYFXOZSDRDHKOVBNDWJACTX46ESWRPYX2OJZXMYCYUA';

	console.log(`\n${'='.repeat(80)}`);
	console.log(`Checking transaction: ${txId}`);
	console.log('='.repeat(80));

	// Check if transaction exists
	const transactions = await db
		.select()
		.from(algorandTransaction)
		.where(eq(algorandTransaction.txId, txId));

	if (transactions.length === 0) {
		console.log('\n✗ Transaction not found in database');
		process.exit(1);
	}

	const tx = transactions[0];
	console.log('\n✓ Found in algorand_transaction table:');
	console.log(`  Transaction ID: ${tx.txId}`);
	console.log(`  Round: ${tx.round}`);
	console.log(`  Timestamp: ${tx.timestamp}`);
	console.log(`  Sender: ${tx.sender}`);
	console.log(`\n  Decoded Note:`);
	console.log('  ' + '-'.repeat(78));
	console.log(tx.noteDecoded?.split('\n').map(line => '  ' + line).join('\n'));
	console.log('  ' + '-'.repeat(78));

	// Check roasting data
	const roasting = await db
		.select()
		.from(roastingData)
		.where(eq(roastingData.transactionId, tx.id));

	if (roasting.length > 0) {
		const r = roasting[0];
		console.log('\n✓ Found in roasting_data table:');
		console.log(`  Parent Company ID: ${r.parentCompanyId}`);
		console.log(`  Production Batch ID: ${r.productionBatchId}`);
		console.log(`  Type of Roast: ${r.typeOfRoast || 'N/A'}`);
		console.log(`  Location: ${r.locationOfRoastingPlant || 'N/A'}`);
		console.log(`  Kg Roasted: ${r.kgCoffeeRoasted || 'N/A'}`);
		console.log(`  Roast Date: ${r.roastDate || 'N/A'}`);
		console.log(`\n  Zone 1:`);
		console.log(`    Coffee Species: ${r.zone1CoffeeSpecies || 'N/A'}`);
		console.log(`    Harvest: ${r.zone1HarvestBegin || 'N/A'} to ${r.zone1HarvestEnd || 'N/A'}`);
		console.log(`\n  Zone 2:`);
		console.log(`    Coffee Species: ${r.zone2CoffeeSpecies || 'N/A'}`);
		console.log(`    Harvest: ${r.zone2HarvestBegin || 'N/A'} to ${r.zone2HarvestEnd || 'N/A'}`);
		console.log(`\n  Child TX: ${r.childTx || 'N/A'}`);
		console.log(`  Created At: ${r.createdAt}`);
	} else {
		console.log('\n✗ Not found in roasting_data table');
	}

	// Check processing data
	const processing = await db
		.select()
		.from(processingData)
		.where(eq(processingData.transactionId, tx.id));

	if (processing.length > 0) {
		const p = processing[0];
		console.log('\n✓ Found in processing_data table:');
		console.log(`  Reception IDs: ${p.receptionIds || 'N/A'}`);
		console.log(`  Post-hull IDs: ${p.postHullIds || 'N/A'}`);
		console.log(`  Size of Beans: ${p.sizeOfBeans || 'N/A'}`);
		console.log(`  Qty Green Coffee: ${p.qtyGreenCoffee || 'N/A'}`);
		console.log(`  Sort Entry: ${p.sortEntry || 'N/A'}`);
		console.log(`  Sort Exit: ${p.sortExit || 'N/A'}`);
		console.log(`  Harvest Begin: ${p.harvestBegin || 'N/A'}`);
		console.log(`  Harvest End: ${p.harvestEnd || 'N/A'}`);
		console.log(`  Created At: ${p.createdAt}`);
	} else {
		console.log('\n✗ Not found in processing_data table');
	}

	console.log('\n' + '='.repeat(80));
	process.exit(0);
}

main().catch(error => {
	console.error('\nError:', error);
	process.exit(1);
});
