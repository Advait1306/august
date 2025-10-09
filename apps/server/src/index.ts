import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { clerkMiddleware, getAuth } from "@clerk/express";
import express from "express";
import cors from "cors";
import { organisations, users } from "@jupiter/sync/db/schema";
import { createMutators } from "@jupiter/sync/mutators/data";
import { createServerMutators } from "@jupiter/sync/server-mutators/data";
import bodyParser from "body-parser";
import {
  handleGetQueriesRequest,
  PushProcessor,
  ZQLDatabase,
} from "@rocicorp/zero/server";
import { schema } from "@jupiter/sync/zero/schema";

const app = express();

app.use(cors());
app.use(clerkMiddleware());

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Webhook } from "svix";
import { ReadonlyJSONValue, withValidation } from "@rocicorp/zero";
import {
  AuthData,
  getAgents,
  getMessages,
  getProjects,
  getTasks,
} from "@jupiter/sync/queries/data";
import { PostgresJSConnection } from "@rocicorp/zero/pg";
import postgres from "postgres";

const db = drizzle(process.env.DATABASE_URL!);
const wh = new Webhook(process.env.CLERK_WEBHOOK_KEY!);

// Clerk Websocket
app.post(
  "/clerk",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const payload = req.body;
    const headers = req.headers as Record<string, string>;

    let parsedPayload;
    try {
      wh.verify(payload, headers);
      parsedPayload = JSON.parse(payload.toString());
    } catch (err) {
      console.error("Clerk Webhook verification failed:", err);
      return res.sendStatus(400);
    }

    switch (parsedPayload.type) {
      case "user.created": {
        const userInsert: typeof users.$inferInsert = {
          id: parsedPayload.data.id,
        };
        const orgInsert: typeof organisations.$inferInsert = {
          id: parsedPayload.data.id,
        };
        await db.insert(users).values(userInsert);
        await db.insert(organisations).values(orgInsert);
        res.sendStatus(200);
        break;
      }

      case "user.deleted": {
        await db.delete(users).where(eq(users.id, parsedPayload.data.id));
        await db
          .delete(organisations)
          .where(eq(organisations.id, parsedPayload.data.id));
        res.sendStatus(200);
        break;
      }

      case "organization.created": {
        const organisationInsert: typeof organisations.$inferInsert = {
          id: parsedPayload.data.id,
        };
        await db.insert(organisations).values(organisationInsert);
        res.sendStatus(200);
        break;
      }

      case "organization.deleted": {
        await db
          .delete(organisations)
          .where(eq(organisations.id, parsedPayload.data.id));
        res.sendStatus(200);
        break;
      }

      default: {
        res.sendStatus(400);
        break;
      }
    }
  }
);

// Add JSON body parser for other routes
app.use(bodyParser.json());

// Clerk Ticket
app.get("/ticket", async (req, res) => {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  // Generate a ticket token using Clerk's API
  const response = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("Clerk API error:", errorData);
    return res.status(500).json({ error: "Failed to generate token" });
  }

  const data = await response.json();

  return res.status(200).json({
    ticket: data.token,
  });
});

// Zero get queries
const validated = Object.fromEntries(
  [
    // auth'd query
    getTasks,
    getMessages,
    getAgents,
    getProjects,
  ].map((q) => [q.queryName, withValidation(q)])
);

function getQuery(
  authData: AuthData,
  name: string,
  args: readonly ReadonlyJSONValue[]
) {
  const q = validated[name];
  if (!q) {
    throw new Error(`No such query: ${name}`);
  }
  return {
    // First param is the context for contextful queries.
    // `args` are validated using the `parser` you provided with
    // the query definition.
    query: q(authData, ...args),
  };
}

app.post("/get-queries", async (req, res) => {
  const { isAuthenticated, userId, orgId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  return await res.json(
    await handleGetQueriesRequest(
      (name, args) =>
        getQuery(
          {
            userId,
            orgId: orgId ?? userId,
          },
          name,
          args
        ),
      schema,
      req.body
    )
  );
});

const processor = new PushProcessor(
  new ZQLDatabase(
    new PostgresJSConnection(postgres(process.env.DATABASE_URL! as string)),
    schema
  )
);

// Zero mutators
app.post("/push", async (req, res) => {
  const { isAuthenticated, userId, orgId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const asyncTasks: Array<() => Promise<void>> = [];

  const result = await processor.process(
    createServerMutators(
      createMutators({ userId, orgId: orgId ?? userId }),
      { userId, orgId: orgId ?? userId },
      asyncTasks
    ),
    req.query as Record<string, string>,
    req.body
  );

  await Promise.all(asyncTasks.map((task) => task()));
  return await res.json(result);
});

app.listen(8080, () => {
  console.log("Server is running on port 8080");
});
