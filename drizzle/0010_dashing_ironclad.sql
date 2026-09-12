CREATE TABLE IF NOT EXISTS `disposal_records` (
	`id` text PRIMARY KEY NOT NULL,
	`machinery_code` text NOT NULL,
	`proposed_date` text NOT NULL,
	`document_number` text NOT NULL,
	`reason` text NOT NULL,
	`responsible_person` text NOT NULL,
	`status` text DEFAULT 'AWAITING_DISPOSAL' NOT NULL,
	`approval_date` text,
	`approval_document` text,
	`approver` text,
	`note` text,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `disposal_records_machinery_code_unique` ON `disposal_records` (`machinery_code`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_disposal_records_date` ON `disposal_records` (`proposed_date`);
