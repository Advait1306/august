ALTER TYPE "public"."block_status" ADD VALUE 'mcp_pending' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "metadata" jsonb;