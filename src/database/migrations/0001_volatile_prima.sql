ALTER TABLE `employees` ADD CONSTRAINT `employees_org_code_unq` UNIQUE(`organization_id`,`employee_id`);--> statement-breakpoint
CREATE INDEX `attendance_emp_time_idx` ON `attendance_records` (`employee_id`,`server_time`);--> statement-breakpoint
CREATE INDEX `attendance_org_time_idx` ON `attendance_records` (`organization_id`,`server_time`);--> statement-breakpoint
CREATE INDEX `attendance_status_idx` ON `attendance_records` (`status`);--> statement-breakpoint
CREATE INDEX `audit_org_created_idx` ON `audit_logs` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);