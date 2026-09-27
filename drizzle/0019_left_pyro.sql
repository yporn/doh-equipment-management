ALTER TABLE `repair_records` ADD `meter_reading` real;--> statement-breakpoint
ALTER TABLE `repair_records` ADD `meter_unit` text;--> statement-breakpoint
ALTER TABLE `repair_records` ADD `meter_unreadable` integer DEFAULT false NOT NULL;