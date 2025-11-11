CREATE TABLE `processing_data` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`tx_id` text NOT NULL,
	`reception_ids` text,
	`post_hull_ids` text,
	`size_of_beans` text,
	`qty_green_coffee` text,
	`sort_entry` text,
	`sort_exit` text,
	`harvest_begin` text,
	`harvest_end` text,
	`raw_data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `algorand_transaction`(`id`) ON UPDATE no action ON DELETE no action
);
