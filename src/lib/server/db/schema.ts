import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	age: integer('age')
});

// Track the last sync status for each Algorand address
export const syncStatus = sqliteTable('sync_status', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	address: text('address').notNull().unique(),
	lastProcessedRound: integer('last_processed_round'),
	lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull()
});

// Store raw Algorand transactions
export const algorandTransaction = sqliteTable('algorand_transaction', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	txId: text('tx_id').notNull().unique(),
	address: text('address').notNull(),
	round: integer('round').notNull(),
	timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
	noteRaw: text('note_raw'), // Base64 encoded note
	noteDecoded: text('note_decoded'), // UTF-8 decoded note
	sender: text('sender'),
	receiver: text('receiver'),
	amount: integer('amount'),
	fee: integer('fee'),
	txType: text('tx_type'),
	rawJson: text('raw_json'), // Full transaction JSON
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull()
});

// Store parsed roasting data from transaction notes
export const roastingData = sqliteTable('roasting_data', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	transactionId: text('transaction_id')
		.notNull()
		.unique()
		.references(() => algorandTransaction.id),
	txId: text('tx_id').notNull(), // Algorand transaction ID
	parentCompanyId: text('parent_company_id'),
	productionBatchId: text('production_batch_id'),
	typeOfRoast: text('type_of_roast'),
	locationOfRoastingPlant: text('location_of_roasting_plant'),
	kgCoffeeRoasted: text('kg_coffee_roasted'),
	roastDate: text('roast_date'),
	zone1CoffeeSpecies: text('zone1_coffee_species'),
	zone1HarvestBegin: text('zone1_harvest_begin'),
	zone1HarvestEnd: text('zone1_harvest_end'),
	zone2CoffeeSpecies: text('zone2_coffee_species'),
	zone2HarvestBegin: text('zone2_harvest_begin'),
	zone2HarvestEnd: text('zone2_harvest_end'),
	childTx: text('child_tx'),
	rawData: text('raw_data'), // Store the full parsed note for reference
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull()
});

// Store parsed processing data from transaction notes
export const processingData = sqliteTable('processing_data', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	transactionId: text('transaction_id')
		.notNull()
		.unique()
		.references(() => algorandTransaction.id),
	txId: text('tx_id').notNull(), // Algorand transaction ID
	receptionIds: text('reception_ids'), // Comma-separated list
	postHullIds: text('post_hull_ids'), // Comma-separated list
	sizeOfBeans: text('size_of_beans'),
	qtyGreenCoffee: text('qty_green_coffee'), // Qty of green coffee selected by Lavazza
	sortEntry: text('sort_entry'), // Sort entry date
	sortExit: text('sort_exit'), // Sort exit date
	harvestBegin: text('harvest_begin'),
	harvestEnd: text('harvest_end'),
	rawData: text('raw_data'), // Store the full parsed note for reference
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull()
});

// Store parsed harvest/farm data from transaction notes
export const harvestData = sqliteTable('harvest_data', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	transactionId: text('transaction_id')
		.notNull()
		.references(() => algorandTransaction.id),
	txId: text('tx_id').notNull(), // Algorand transaction ID
	farmId: text('farm_id'),
	farmAnagraphic: text('farm_anagraphic'),
	farmLocation: text('farm_location'),
	fieldsData: text('fields_data'), // JSON string with array of field objects
	rawData: text('raw_data'), // Store the full parsed note for reference
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull()
});
