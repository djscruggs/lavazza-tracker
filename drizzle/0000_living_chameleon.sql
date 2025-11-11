CREATE TABLE `algorand_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`tx_id` text NOT NULL,
	`address` text NOT NULL,
	`round` integer NOT NULL,
	`timestamp` integer NOT NULL,
	`note_raw` text,
	`note_decoded` text,
	`sender` text,
	`receiver` text,
	`amount` integer,
	`fee` integer,
	`tx_type` text,
	`raw_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `algorand_transaction_tx_id_unique` ON `algorand_transaction` (`tx_id`);--> statement-breakpoint
CREATE TABLE `roasting_data` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`tx_id` text NOT NULL,
	`parent_company_id` text,
	`production_batch_id` text,
	`type_of_roast` text,
	`location_of_roasting_plant` text,
	`kg_coffee_roasted` text,
	`roast_date` text,
	`zone1_coffee_species` text,
	`zone1_harvest_begin` text,
	`zone1_harvest_end` text,
	`zone2_coffee_species` text,
	`zone2_harvest_begin` text,
	`zone2_harvest_end` text,
	`child_tx` text,
	`raw_data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `algorand_transaction`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sync_status` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`last_processed_round` integer,
	`last_synced_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_status_address_unique` ON `sync_status` (`address`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`age` integer
);
