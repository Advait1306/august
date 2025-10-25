import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { clerkMiddleware } from "@clerk/express";
import mixpanel from "mixpanel";

// Config
import { db, processor } from "./config/database";

// Middleware
import { apiKeyToAuthMiddleware } from "./middleware/apiKeyToAuth";

// Services
import { ClerkService } from "./services/clerk.service";
import { BillingService } from "./services/billing.service";
import { SyncService } from "./services/sync.service";
import { ProxyService } from "./services/proxy.service";

// Controllers
import { createClerkController } from "./controllers/clerk.controller";
import { createSyncController } from "./controllers/sync.controller";
import { createProxyController } from "./controllers/proxy.controller";

const app = express();

// Initialize Mixpanel
const mp = mixpanel.init(process.env.MIXPANEL_TOKEN!, {
  host: "api-eu.mixpanel.com",
});

// Middleware setup
app.use(cors());
app.use(apiKeyToAuthMiddleware);
app.use(clerkMiddleware());

// Initialize services
const clerkService = new ClerkService(db);
const billingService = new BillingService(db);
const syncService = new SyncService(processor, mp);
const proxyService = new ProxyService(billingService);

// Clerk webhook needs raw body parser
app.use(
  "/clerk",
  bodyParser.raw({ type: "application/json" }),
  createClerkController(clerkService)
);

// Other routes use JSON body parser
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Mount controllers
app.use(createClerkController(clerkService));
app.use(createSyncController(syncService));
app.use(createProxyController(proxyService, billingService));

app.listen(8080, () => {
  console.log("Server is running on port 8080");
});
