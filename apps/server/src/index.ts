import dotenv from "dotenv";
dotenv.config();

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
// import DodoPayments from "dodopayments";
import { deductUsageCost } from "./pricing";

const app = express();
const mp = mixpanel.init(process.env.MIXPANEL_TOKEN!, {
  host: "api-eu.mixpanel.com",
});
// const dodoClient = new DodoPayments({
//   bearerToken: process.env.DODO_PAYMENTS_API_KEY, // This is the default and can be omitted
//   environment: "test_mode", // defaults to 'live_mode'
// });

app.use(cors());

// Middleware to convert x-api-key to authorization header for cc-proxy routes
app.use((req, _res, next) => {
  if (req.path.startsWith("/cc-proxy")) {
    const apiKey = req.headers["x-api-key"];
    if (apiKey && typeof apiKey === "string") {
      req.headers["authorization"] = `Bearer ${apiKey}`;
    }
  }
  next();
});

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
import mixpanel from "mixpanel";

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

        await db.insert(users).values(userInsert);

        // const customerCreateResponse = await dodoClient.customers.create({
        //   email: `${parsedPayload.data.id}@user.august.com`,
        //   name:
        //     parsedPayload.data.first_name + " " + parsedPayload.data.last_name,
        // });

        const orgInsert: typeof organisations.$inferInsert = {
          id: parsedPayload.data.id,
        };

        await db.insert(organisations).values(orgInsert);

        // await dodoClient.customers.wallets.ledgerEntries.create(
        //   customerCreateResponse.customer_id,
        //   {
        //     amount: 500,
        //     currency: "USD",
        //     entry_type: "credit",
        //     reason: "Welcome Credits",
        //     idempotency_key: `${parsedPayload.data.id}-welcome-credits`,
        //   }
        // );

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
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

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
      asyncTasks,
      mp
    ),
    req.query as Record<string, string>,
    req.body
  );

  await Promise.all(asyncTasks.map((task) => task()));
  return await res.json(result);
});

app.post("/cc-proxy/v1/messages", async (req, res) => {
  const { isAuthenticated, userId, orgId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  // Check organisation wallet balance
  try {
    const org = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, orgId ?? userId))
      .limit(1);

    if (!org || org.length === 0) {
      return res.status(404).json({ error: "Organisation not found" });
    }

    if (org[0].wallet < 0) {
      return res
        .status(402)
        .json({ error: "Insufficient balance. Please add credits to continue." });
    }
  } catch (error) {
    console.error("Failed to check wallet balance:", error);
    return res.status(500).json({ error: "Failed to check wallet balance" });
  }

  try {
    // Forward request to Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version":
          (req.headers["anthropic-version"] as string) || "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    // Copy response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(response.status);

    // Handle streaming response
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedData = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamedData += chunk;
        res.write(chunk);
      }

      res.end();

      // Try to parse as a complete message object first (non-SSE format)
      try {
        const completeMessage = JSON.parse(streamedData);
        if (completeMessage.type === "message" && completeMessage.usage) {
          const usageLog = {
            userId,
            orgId: orgId ?? userId,
            model: completeMessage.model,
            usage: completeMessage.usage,
            timestamp: new Date().toISOString(),
          };

          console.log("=== Anthropic Usage Data (Initial Message) ===");
          console.log(JSON.stringify(usageLog, null, 2));

          // Deduct usage cost
          await deductUsageCost(
            db,
            orgId ?? userId,
            completeMessage.model,
            completeMessage.usage
          );

          return;
        }
      } catch {
        // Not a complete JSON message, continue to parse as SSE
      }

      // Extract model name and usage data from message_start event
      const messageStartMatch = streamedData.match(
        /event:\s*message_start\s*\ndata:\s*({.*?})\s*\n/s
      );
      if (messageStartMatch) {
        try {
          const messageStartData = JSON.parse(messageStartMatch[1]);
          const model = messageStartData.message?.model;
          const messageId = messageStartData.message?.id;
          let usage = messageStartData.message?.usage;

          // Extract final usage data from message_delta event (has complete output_tokens)
          const messageDeltaMatch = streamedData.match(
            /event:\s*message_delta\s*\ndata:\s*({.*?})\s*\n/s
          );
          if (messageDeltaMatch) {
            const messageDeltaData = JSON.parse(messageDeltaMatch[1]);
            if (messageDeltaData.usage) {
              usage = messageDeltaData.usage;
            }
          }

          // Create consolidated usage object
          const usageLog = {
            userId,
            orgId: orgId ?? userId,
            model,
            usage,
            timestamp: new Date().toISOString(),
          };

          console.log("=== Anthropic Usage Data ===");
          console.log(JSON.stringify(usageLog, null, 2));

          // Deduct usage cost
          if (model && usage && messageId) {
            await deductUsageCost(db, orgId ?? userId, model, usage);
          }
        } catch (e) {
          console.error("Failed to parse streaming events:", e);
        }
      }
    } else {
      // NOTE: Dead code, never seems to run
      const data = await response.json();

      // Create consolidated usage object for non-streaming response
      if (data.usage) {
        const usageLog = {
          userId,
          orgId: orgId ?? userId,
          model: data.model,
          usage: data.usage,
          timestamp: new Date().toISOString(),
        };

        console.log("=== Anthropic Usage Data (Non-Streaming) ===");
        console.log(JSON.stringify(usageLog, null, 2));

        // Deduct usage cost
        if (data.model && data.usage && data.id) {
          await deductUsageCost(db, orgId ?? userId, data.model, data.usage);
        }
      }

      res.json(data);
    }
  } catch (error) {
    console.error("Error forwarding request to Anthropic:", error);
    res.status(500).json({ error: "Failed to forward request" });
  }
});

app.listen(8080, () => {
  console.log("Server is running on port 8080");
});
