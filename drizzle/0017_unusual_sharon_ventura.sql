CREATE TABLE `central_rental_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`fiscal_year` integer NOT NULL,
	`month` text NOT NULL,
	`project` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `central_rental_allocations_unique` ON `central_rental_allocations` (`fiscal_year`,`month`);