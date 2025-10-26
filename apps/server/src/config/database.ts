import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import postgres from "postgres";
import { PostgresJSConnection } from "@rocicorp/zero/pg";
import { PushProcessor, ZQLDatabase } from "@rocicorp/zero/server";
import { schema } from "@jupiter/sync/zero/schema";

// Drizzle database instance
export const db = drizzle(process.env.DATABASE_URL!);

// Zero sync processor
export const processor = new PushProcessor(
  new ZQLDatabase(
    new PostgresJSConnection(postgres(process.env.DATABASE_URL! as string)),
    schema
  )
);

export type processorType = typeof processor;
