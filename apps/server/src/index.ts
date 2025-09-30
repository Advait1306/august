import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { clerkMiddleware, getAuth } from "@clerk/express";
import express from "express";
import cors from "cors";
import { users } from "./db/schema";
import bodyParser from "body-parser";

const app = express();

app.use(cors());
app.use(clerkMiddleware());

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Webhook } from "svix";
const db = drizzle(process.env.DATABASE_URL!);
const wh = new Webhook(process.env.CLERK_WEBHOOK_KEY!);

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

    if (parsedPayload.type === "user.created") {
      const userInsert: typeof users.$inferInsert = {
        user_id: parsedPayload.data.id,
      };

      await db.insert(users).values(userInsert);

      res.sendStatus(200);
    } else if (parsedPayload.type === "user.deleted") {
      await db.delete(users).where(eq(users.user_id, parsedPayload.data.id));

      res.sendStatus(200);
    } else {
      res.sendStatus(400);
    }
  }
);

// Add JSON body parser for other routes
app.use(bodyParser.json());

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

app.listen(8080, () => {
  console.log("Server is running on port 8080");
});
