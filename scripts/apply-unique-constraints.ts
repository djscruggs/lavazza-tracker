#!/usr/bin/env tsx
/**
 * Apply Unique Constraints
 *
 * Applies unique constraints to prevent duplicate records
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
	url: process.env.DATABASE_URL!,
	authToken: process.env.DATABASE_AUTH_TOKEN!
});

async function main() {
	console.log('\n' + '='.repeat(80));
	console.log('APPLYING UNIQUE CONSTRAINTS');
	console.log('='.repeat(80));

	try {
		// Apply unique constraint to processing_data
		console.log('\nCreating unique index on processing_data.transaction_id...');
		await client.execute(
			'CREATE UNIQUE INDEX IF NOT EXISTS `processing_data_transaction_id_unique` ON `processing_data` (`transaction_id`)'
		);
		console.log('✓ Created unique index on processing_data');

		// Apply unique constraint to roasting_data
		console.log('\nCreating unique index on roasting_data.transaction_id...');
		await client.execute(
			'CREATE UNIQUE INDEX IF NOT EXISTS `roasting_data_transaction_id_unique` ON `roasting_data` (`transaction_id`)'
		);
		console.log('✓ Created unique index on roasting_data');

		console.log('\n' + '='.repeat(80));
		console.log('UNIQUE CONSTRAINTS APPLIED SUCCESSFULLY');
		console.log('='.repeat(80));
		console.log('These constraints will prevent duplicate records from being created.');
		console.log('='.repeat(80));
	} catch (error) {
		console.error('\nError applying constraints:', error);
		throw error;
	}

	process.exit(0);
}

main().catch(error => {
	console.error('\nFatal error:', error);
	process.exit(1);
});
