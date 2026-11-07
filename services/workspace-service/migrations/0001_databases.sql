CREATE TABLE `databases` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`parent_id` text,
	`title` text DEFAULT 'Untitled Database' NOT NULL,
	`description` text,
	`icon` text,
	`cover_file_id` text,
	`is_inline` integer DEFAULT false NOT NULL,
	`properties` text NOT NULL,
	`default_view_id` text,
	`is_trashed` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `databases_workspace_idx` ON `databases` (`workspace_id`,`is_trashed`);
--> statement-breakpoint
CREATE TABLE `database_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`database_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`properties` text NOT NULL,
	`is_trashed` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `database_rows_database_idx` ON `database_rows` (`database_id`,`is_trashed`);
--> statement-breakpoint
CREATE TABLE `database_views` (
	`id` text PRIMARY KEY NOT NULL,
	`database_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`filter` text,
	`sorts` text,
	`group_by` text,
	`chart` text,
	`visible_property_ids` text,
	`column_widths` text,
	`aggregations` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `database_views_database_idx` ON `database_views` (`database_id`);
