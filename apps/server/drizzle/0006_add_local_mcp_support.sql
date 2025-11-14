-- Add 'local' to integration_type enum
ALTER TYPE "public"."integration_type" ADD VALUE 'local';
--> statement-breakpoint

-- Add local MCP configuration columns to mcps table
ALTER TABLE "mcps" ADD COLUMN "local_command" varchar;--> statement-breakpoint
ALTER TABLE "mcps" ADD COLUMN "local_args" jsonb;--> statement-breakpoint
ALTER TABLE "mcps" ADD COLUMN "local_env" jsonb;
