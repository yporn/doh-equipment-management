CREATE TABLE `rental_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`department` text NOT NULL,
	`fiscal_year` integer NOT NULL,
	`plan_amount` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_plans_department_year_unique` ON `rental_plans` (`department`,`fiscal_year`);