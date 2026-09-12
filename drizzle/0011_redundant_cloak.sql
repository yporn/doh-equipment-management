CREATE TABLE IF NOT EXISTS `transfer_records` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_date` text NOT NULL,
	`transporters_json` text NOT NULL,
	`items_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_transfer_records_date` ON `transfer_records` (`transfer_date`);
