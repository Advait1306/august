import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// ONLY USE TO GENERATE ZERO SCHEMA
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
