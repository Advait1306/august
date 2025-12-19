ALTER TYPE "public"."block_type" ADD VALUE 'tool_result' BEFORE 'server_tool_use';--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'starting' BEFORE 'executing';--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "processed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "response_turn_id" varchar;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_response_turn_id_turns_id_fk" FOREIGN KEY ("response_turn_id") REFERENCES "public"."turns"("id") ON DELETE no action ON UPDATE no action;