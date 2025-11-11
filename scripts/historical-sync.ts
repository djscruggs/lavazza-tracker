#!/usr/bin/env tsx
/**
 * Historical Sync Script
 *
 * Fetches ALL historical transactions for the Lavazza address from the Algorand blockchain
 * and stores them in the database.
 *
 * Usage:
 *   npm run sync:historical
 *
 * Options (modify in script):
 *   - batchSize: Number of transactions to fetch per page (default: 100)
 *   - delayBetweenBatches: Delay in ms between API calls (default: 100ms)
 */

import { syncHistoricalTransactions } from '../src/lib/server/historical-sync-cli';

async function main() {
	console.log('='.repeat(60));
	console.log('LAVAZZA HISTORICAL SYNC');
	console.log('='.repeat(60));
	console.log('');
	console.log('This script will fetch ALL historical transactions from Algorand');
	console.log('and store them in your database.');
	console.log('');
	console.log('Press Ctrl+C to cancel at any time.');
	console.log('');
	console.log('='.repeat(60));
	console.log('');

	// Configuration
	const batchSize = 100; // Transactions per page
	const delayBetweenBatches = 100; // Delay in ms between API calls

	try {
		const result = await syncHistoricalTransactions(batchSize, delayBetweenBatches);

		console.log('');
		console.log('='.repeat(60));
		console.log('SYNC COMPLETE');
		console.log('='.repeat(60));
		console.log(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
		console.log(`Total Transactions: ${result.totalTransactions}`);
		console.log(`Pages Processed: ${result.pagesProcessed}`);
		if (result.error) {
			console.log(`Error: ${result.error}`);
		}
		console.log('='.repeat(60));

		process.exit(result.success ? 0 : 1);
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
