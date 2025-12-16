CREATE TYPE "public"."block_status" AS ENUM('none', 'permission_pending', 'client_pending', 'server_pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."block_type" AS ENUM('text', 'tool_use', 'server_tool_use', 'code_execution_tool_result', 'web_search_tool_result', 'thinking');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('available', 'executing', 'stopping');--> statement-breakpoint
CREATE TYPE "public"."turn_type" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"turn_id" varchar NOT NULL,
	"type" "block_type" NOT NULL,
	"status" "block_status" DEFAULT 'none' NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" varchar PRIMARY KEY NOT NULL,
	"type" "turn_type" NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"task_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "last_session_id" varchar;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "worker_id" varchar;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "status" "task_status" DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;