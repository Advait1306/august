CREATE TABLE "runtimes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"tools" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "runtime_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "runtimes" ADD CONSTRAINT "runtimes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_runtime_id_runtimes_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."runtimes"("id") ON DELETE no action ON UPDATE no action;