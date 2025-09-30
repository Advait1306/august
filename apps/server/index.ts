import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { clerkMiddleware, getAuth } from "@clerk/express";
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(clerkMiddleware());

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
