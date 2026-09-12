CREATE TABLE `service_document_counters` (
	`fiscal_year` integer PRIMARY KEY NOT NULL,
	`last_sequence` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `service_records` ADD `document_number` text;--> statement-breakpoint
ALTER TABLE `service_records` ADD `fiscal_year` integer;--> statement-breakpoint
ALTER TABLE `service_records` ADD `document_sequence` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `service_records_document_number_unique` ON `service_records` (`document_number`);