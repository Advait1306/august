CREATE TABLE "skill_documents" (
	"id" varchar PRIMARY KEY NOT NULL,
	"skill_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"content" varchar NOT NULL,
	"description" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"prompt" varchar NOT NULL,
	"description" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_skills" (
	"task_id" varchar NOT NULL,
	"skill_id" varchar NOT NULL,
	CONSTRAINT "task_skills_task_id_skill_id_pk" PRIMARY KEY("task_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "agents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "agents" CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "skill_documents" ADD CONSTRAINT "skill_documents_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_skills" ADD CONSTRAINT "task_skills_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_skills" ADD CONSTRAINT "task_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "agent_id";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "worker_id";--> statement-breakpoint
DROP TYPE "public"."base_agent";