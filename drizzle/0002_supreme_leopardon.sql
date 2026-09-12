CREATE TABLE `service_records` (
	`id` text PRIMARY KEY NOT NULL,
	`machinery_code` text NOT NULL,
	`service_date` text NOT NULL,
	`meter_reading` real,
	`meter_unit` text,
	`provider` text,
	`technician` text,
	`items_json` text NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
