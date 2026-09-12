CREATE TABLE `repair_records` (
	`id` text PRIMARY KEY NOT NULL,
	`machinery_code` text NOT NULL,
	`repair_date` text NOT NULL,
	`work_systems_json` text NOT NULL,
	`symptom` text NOT NULL,
	`cause` text,
	`repair_details` text,
	`reporter` text NOT NULL,
	`responsible_person` text,
	`provider` text,
	`parts_json` text DEFAULT '[]' NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'WAITING' NOT NULL,
	`completed_date` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_repair_records_machinery_date` ON `repair_records` (`machinery_code`,`repair_date`);--> statement-breakpoint
CREATE INDEX `idx_repair_records_status_date` ON `repair_records` (`status`,`repair_date`);--> statement-breakpoint
ALTER TABLE `machineries` ADD `repair_status` text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
