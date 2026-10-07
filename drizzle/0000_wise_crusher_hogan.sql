CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`incident_id` text NOT NULL,
	`actor` text NOT NULL,
	`timestamp` text NOT NULL,
	`disposition` text NOT NULL,
	`reason` text NOT NULL,
	`previous_hash` text NOT NULL,
	`hash` text NOT NULL,
	`version` integer NOT NULL,
	`idempotency_key` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_run` ON `audit_log` (`run_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `operational_chunks` (
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`part` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`run_id`, `kind`, `part`)
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created` text NOT NULL,
	`seed` integer,
	`count` integer NOT NULL,
	`manifest` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `incident_states` (
	`run_id` text NOT NULL,
	`incident_id` text NOT NULL,
	`disposition` text NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`run_id`, `incident_id`)
);
--> statement-breakpoint
CREATE TABLE `sealed_truth_chunks` (
	`run_id` text NOT NULL,
	`part` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`run_id`, `part`)
);
