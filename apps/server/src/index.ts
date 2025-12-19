import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { clerkMiddleware, createClerkClient } from "@clerk/express";
import mixpanel from "mixpanel";
import DodoPayments from "dodopayments";

// Config
import { db, processor } from "./config/state";

// Middleware
import { apiKeyToAuthMiddleware } from "./middleware/apiKeyToAuth";

// Services
import { ClerkService } from "./services/clerk.service";
import { BillingService } from "./services/billing.service";
import { SyncService } from "./services/sync.service";
import { ProxyService } from "./services/proxy.service";
import { OAuthService } from "./services/oauth.service";
import { ComposioService } from "./services/composio.service";

// Controllers
import { createClerkController } from "./controllers/clerk.controller";
import { createSyncController } from "./controllers/sync.controller";
import { createProxyController } from "./controllers/proxy.controller";
import { createBillingController } from "./controllers/billing.controller";
import { createMCPController } from "./controllers/mcp.controller";
import { createRedirectController } from "./controllers/redirect.controller";
import { createBullDashboardAndAttachRouter } from "./queues/dashboard";
import { gracefulShutdown } from "./queues/factory";

const app = express();

// Initialize Mixpanel
const mp = mixpanel.init(process.env.MIXPANEL_TOKEN!, {
  host: "api-eu.mixpanel.com",
});

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

// Initialize DodoPayments client
const dodoClient = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT! as
    | "live_mode"
    | "test_mode",
});

// Middleware setup
app.use(cors());
app.use(apiKeyToAuthMiddleware);
app.use(clerkMiddleware());

// Initialize services
const clerkService = new ClerkService(db);
const billingService = new BillingService(db);
const oauthService = new OAuthService(db);
const composioService = new ComposioService(db);
const syncService = new SyncService(processor, mp, oauthService);
const proxyService = new ProxyService(billingService, oauthService);

// Clerk webhook needs raw body parser
app.use("/clerk", bodyParser.raw({ type: "application/json" }));

// DodoPayments webhook needs raw body parser
app.use("/api/webhooks/dodo", bodyParser.raw({ type: "application/json" }));

// Other routes use JSON body parser
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Mount controllers
app.use(createClerkController(clerkService));
app.use(createSyncController(syncService));
app.use(
  createProxyController(
    proxyService,
    billingService,
    oauthService,
    composioService,
    db
  )
);
app.use(createBillingController(clerkClient, db, dodoClient, billingService));
app.use(createMCPController(db));
app.use(createRedirectController());

// Mount Bull Dashboard
createBullDashboardAndAttachRouter(app, clerkClient);

const server = app.listen(8080, () => {
  console.log("Server is running on port 8080");
});

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    console.log("HTTP server closed");
  });

  // Shutdown workers and queues (30s timeout for in-progress jobs)
  await gracefulShutdown(5000);

  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
