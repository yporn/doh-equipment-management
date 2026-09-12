CREATE TABLE IF NOT EXISTS `transfer_department_baselines` (
	`machinery_code` text PRIMARY KEY NOT NULL,
	`department` text NOT NULL,
	`current_department` text
);
