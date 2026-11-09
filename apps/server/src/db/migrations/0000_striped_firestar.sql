CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`string_index` integer NOT NULL,
	`target_note` integer NOT NULL,
	`target_midi` integer NOT NULL,
	`played_midi` integer NOT NULL,
	`correct` integer NOT NULL,
	`response_time_ms` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_session_id_idx` ON `attempts` (`session_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`selected_strings` text NOT NULL,
	`selected_notes` text NOT NULL,
	`fret_min` integer NOT NULL,
	`fret_max` integer NOT NULL,
	`accidental_style` text NOT NULL,
	`sensitivity` real NOT NULL,
	`weight_weak_notes` integer NOT NULL,
	`updated_at` integer NOT NULL
);
