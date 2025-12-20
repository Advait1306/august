import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { schema } from "@jupiter/sync/zero/schema";
import * as dbSchema from "@jupiter/sync/db/schema";

// Drizzle database instance
export const db = drizzle(process.env.DATABASE_URL!, { schema: dbSchema });

// Zero database provider using Drizzle
export const dbProvider = zeroDrizzle(schema, db);

export type DbProviderType = typeof dbProvider;

export interface AppState {
  db: typeof db;
}

export const state = {
  db,
};
