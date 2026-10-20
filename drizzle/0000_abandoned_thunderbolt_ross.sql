CREATE TABLE `couples` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`since` text,
	`invite_hash` text NOT NULL,
	`invite_expires` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_unique` ON `couples` (`invite_hash`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`user_id` text PRIMARY KEY NOT NULL,
	`couple_id` text NOT NULL,
	`latitude` text NOT NULL,
	`longitude` text NOT NULL,
	`accuracy` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `members`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`couple_id`) REFERENCES `couples`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`couple_id` text NOT NULL,
	`slot` integer NOT NULL,
	`name` text NOT NULL,
	`mood` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`couple_id`) REFERENCES `couples`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `two_people_only` ON `members` (`couple_id`,`slot`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`couple_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`creator` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`couple_id`) REFERENCES `couples`(`id`) ON UPDATE no action ON DELETE no action
);
