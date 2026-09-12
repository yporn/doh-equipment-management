CREATE TABLE `machineries` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`serial_number` text NOT NULL,
	`department` text NOT NULL,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`acquired_year` integer,
	`daily_rate` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `machineries_code_unique` ON `machineries` (`code`);