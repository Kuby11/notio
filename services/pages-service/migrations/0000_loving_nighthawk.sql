CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`type` text NOT NULL,
	`position` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `blocks_page_position_idx` ON `blocks` (`page_id`,`position`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`parent_id` text,
	`title` text DEFAULT '' NOT NULL,
	`icon` text,
	`cover_file_id` text,
	`position` text NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`is_trashed` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pages_workspace_parent_position_idx` ON `pages` (`workspace_id`,`parent_id`,`position`);--> statement-breakpoint
CREATE INDEX `pages_workspace_updated_idx` ON `pages` (`workspace_id`,`updated_at`);