CREATE TABLE `harvest_data` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`tx_id` text NOT NULL,
	`farm_id` text,
	`farm_anagraphic` text,
	`farm_location` text,
	`fields_data` text,
	`raw_data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `algorand_transaction`(`id`) ON UPDATE no action ON DELETE no action
);
