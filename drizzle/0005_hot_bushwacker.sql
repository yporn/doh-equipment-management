CREATE TABLE `rentals` (
	`id` text PRIMARY KEY NOT NULL,
	`machinery_code` text NOT NULL,
	`renter_name` text NOT NULL,
	`start_date` text NOT NULL,
	`expected_return_date` text NOT NULL,
	`returned_date` text,
	`rate_type` text NOT NULL,
	`rate_amount` real NOT NULL,
	`approver` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rentals_status_start_date` ON `rentals` (`status`,`start_date`);--> statement-breakpoint
CREATE INDEX `idx_rentals_machinery_code` ON `rentals` (`machinery_code`);