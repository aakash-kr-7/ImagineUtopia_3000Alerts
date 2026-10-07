DROP INDEX `idx_audit_run`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_audit_run_sequence` ON `audit_log` (`run_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_audit_run_idempotency` ON `audit_log` (`run_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_runs_owner_created` ON `runs` (`owner`,`created`);