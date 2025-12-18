import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import postgres from "postgres";
import { PostgresJSConnection } from "@rocicorp/zero/pg";
import { PushProcessor, ZQLDatabase } from "@rocicorp/zero/server";
import { schema } from "@jupiter/sync/zero/schema";
import * as dbSchema from "@jupiter/sync/db/schema";

// Drizzle database instance
export const db = drizzle(process.env.DATABASE_URL!, { schema: dbSchema });

// Zero sync processor
export const processor = new PushProcessor(
  new ZQLDatabase(
    new PostgresJSConnection(postgres(process.env.DATABASE_URL! as string)),
    schema
  )
);

export type processorType = typeof processor;

export interface AppState {
  db: typeof db;
}

export const state = {
  db,
};
