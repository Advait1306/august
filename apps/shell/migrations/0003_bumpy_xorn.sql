ALTER TABLE `threads` ADD `thread_id` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `threads_thread_id_unique` ON `threads` (`thread_id`);