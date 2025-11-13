CREATE TYPE "public"."integration_type" AS ENUM('oauth', 'composio');--> statement-breakpoint
CREATE TABLE "composio_states" (
	"id" varchar PRIMARY KEY NOT NULL,
	"connection_request_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"mcp_store_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "composio_states_connection_request_id_unique" UNIQUE("connection_request_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_composio_connections" (
	"id" varchar PRIMARY KEY NOT NULL,
	"mcp_id" varchar NOT NULL,
	"connection_url" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_composio_integration_details" (
	"id" varchar PRIMARY KEY NOT NULL,
	"mcp_store_id" varchar NOT NULL,
	"auth_config_id" varchar NOT NULL,
	"mcp_config_id" varchar NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_composio_integration_details_mcp_store_id_unique" UNIQUE("mcp_store_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_connections" (
	"id" varchar PRIMARY KEY NOT NULL,
	"mcp_id" varchar NOT NULL,
	"oauth_client_id" varchar,
	"oauth_client_secret" varchar,
	"access_token" varchar NOT NULL,
	"refresh_token" varchar,
	"token_type" varchar NOT NULL,
	"expires_at" timestamp,
	"scope" varchar,
	"provider_metadata" jsonb,
	"oauth_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_integration_details" (
	"id" varchar PRIMARY KEY NOT NULL,
	"mcp_store_id" varchar NOT NULL,
	"mcp_server_url" varchar NOT NULL,
	"default_scopes" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_oauth_integration_details_mcp_store_id_unique" UNIQUE("mcp_store_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_store" (
	"id" varchar PRIMARY KEY NOT NULL,
	"slug" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar,
	"logo_url" varchar,
	"category" varchar,
	"integration_type" "integration_type" NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_store_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "mcps" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"mcp_store_id" varchar,
	"integration_type" "integration_type" NOT NULL,
	"custom_mcp_server_url" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" varchar PRIMARY KEY NOT NULL,
	"state" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"mcp_store_id" varchar,
	"custom_mcp_url" varchar,
	"custom_mcp_name" varchar,
	"oauth_metadata" jsonb,
	"redirect_uri" varchar NOT NULL,
	"code_verifier" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
ALTER TABLE "projects" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_project_id_projects_id_fk";
DROP TABLE "projects" CASCADE;--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "agent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "composio_states" ADD CONSTRAINT "composio_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composio_states" ADD CONSTRAINT "composio_states_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composio_states" ADD CONSTRAINT "composio_states_mcp_store_id_mcp_store_id_fk" FOREIGN KEY ("mcp_store_id") REFERENCES "public"."mcp_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_composio_connections" ADD CONSTRAINT "mcp_composio_connections_mcp_id_mcps_id_fk" FOREIGN KEY ("mcp_id") REFERENCES "public"."mcps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_composio_integration_details" ADD CONSTRAINT "mcp_composio_integration_details_mcp_store_id_mcp_store_id_fk" FOREIGN KEY ("mcp_store_id") REFERENCES "public"."mcp_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_connections" ADD CONSTRAINT "mcp_oauth_connections_mcp_id_mcps_id_fk" FOREIGN KEY ("mcp_id") REFERENCES "public"."mcps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_integration_details" ADD CONSTRAINT "mcp_oauth_integration_details_mcp_store_id_mcp_store_id_fk" FOREIGN KEY ("mcp_store_id") REFERENCES "public"."mcp_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcps" ADD CONSTRAINT "mcps_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcps" ADD CONSTRAINT "mcps_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcps" ADD CONSTRAINT "mcps_mcp_store_id_mcp_store_id_fk" FOREIGN KEY ("mcp_store_id") REFERENCES "public"."mcp_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_mcp_store_id_mcp_store_id_fk" FOREIGN KEY ("mcp_store_id") REFERENCES "public"."mcp_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "project_id";