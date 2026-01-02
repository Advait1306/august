CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'active', 'on_hold', 'cancelled', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "dodo_customer_portal" (
	"organisation_id" varchar PRIMARY KEY NOT NULL,
	"link" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "subscription_id" varchar;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "subscription_status" "subscription_status";--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "billing_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "task_id" varchar;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "message_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "dodo_customer_portal" ADD CONSTRAINT "dodo_customer_portal_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" DROP COLUMN "wallet";--> statement-breakpoint
ALTER TABLE "usage" DROP COLUMN "cost";--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_message_id_unique" UNIQUE("message_id");