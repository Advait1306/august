import { Request, Response, Router } from "express";
import { ClerkClient, getAuth } from "@clerk/express";
import type DodoPayments from "dodopayments";
import { eq } from "drizzle-orm";
import { organisations } from "@jupiter/sync/db/schema";
import { Webhook } from "standardwebhooks";
import { BillingService } from "../services/billing.service";
import {
  SubscriptionService,
  SubscriptionStatus,
  SUBSCRIPTION_PRODUCT_ID,
  ADDON_SEAT_PRODUCT_ID,
} from "../services/subscription.service";
import { AppState } from "../config/state";

// Product IDs for wallet top-up (different from subscription)
const PRODUCT_ID_DEV_STAGING = "pdt_CyV6Fvwt5AjgHg49qI6qc";
const PRODUCT_ID_PRODUCTION = "pdt_1sxa3DfkaEPHQsR2wzRax";

const PRODUCT_ID =
  process.env.NODE_ENV === "production"
    ? PRODUCT_ID_PRODUCTION
    : PRODUCT_ID_DEV_STAGING;

export function createBillingController(
  clerkClient: ClerkClient,
  db: AppState["db"],
  dodoClient: DodoPayments,
  billingService: BillingService,
  subscriptionService: SubscriptionService
): Router {
  const router = Router();

  /**
   * DodoPayments webhook endpoint
   */
  router.post("/api/webhooks/dodo", async (req: Request, res: Response) => {
    try {
      // Verify webhook signature
      const webhookSecret = process.env.DODO_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("DODO_WEBHOOK_SECRET not configured");
        return res.status(500).json({ error: "Webhook not configured" });
      }

      const webhook = new Webhook(webhookSecret);

      // Get headers
      const headers = {
        "webhook-id": req.headers["webhook-id"] as string,
        "webhook-signature": req.headers["webhook-signature"] as string,
        "webhook-timestamp": req.headers["webhook-timestamp"] as string,
      };

      // Verify the webhook signature
      let event: {
        type: string;
        data: {
          // For payment events
          metadata?: {
            organisation_id?: string;
            amount_usd_cents?: string;
          };
          product_cart?: Array<{ amount?: number }>;
          // For subscription events
          subscription_id?: string;
          status?: SubscriptionStatus;
          customer?: {
            customer_id?: string;
            email?: string;
          };
        };
      };
      try {
        // For raw body, we need to convert buffer to string
        const payload = req.body.toString();
        event = webhook.verify(payload, headers) as typeof event;
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return res.status(401).json({ error: "Invalid signature" });
      }

      // Handle payment.succeeded event
      if (event.type === "payment.succeeded") {
        const { metadata } = event.data;

        // Extract organisation ID from metadata
        const organisationId = metadata?.organisation_id;

        if (!organisationId) {
          console.error("No organisation_id in webhook metadata");
          return res.status(400).json({ error: "Missing organisation_id" });
        }

        // Use the USD amount from metadata (avoids precision loss from currency conversion)
        const amountUsdCents = metadata?.amount_usd_cents;

        if (!amountUsdCents) {
          console.error("No amount_usd_cents in webhook metadata");
          return res.status(400).json({ error: "Missing amount_usd_cents" });
        }

        const totalAmount = parseInt(amountUsdCents);

        if (isNaN(totalAmount) || totalAmount <= 0) {
          console.error("Invalid amount in webhook metadata");
          return res.status(400).json({ error: "Invalid amount" });
        }

        // Add credits to organisation wallet
        const result = await billingService.addCredits(
          organisationId,
          totalAmount
        );

        if (!result.success) {
          console.error("Failed to add credits:", result.error);
          return res.status(500).json({ error: result.error });
        }

        console.log(
          `Webhook processed: Added ${totalAmount}¢ to org ${organisationId}. New balance: ${result.newBalance}¢`
        );

        return res.status(200).json({
          success: true,
          message: "Credits added successfully",
        });
      }

      // Handle subscription events
      if (event.type.startsWith("subscription.")) {
        const { subscription_id, metadata } = event.data;

        if (!subscription_id) {
          console.error("No subscription_id in webhook payload");
          return res.status(400).json({ error: "Missing subscription_id" });
        }

        // Get organisation ID from metadata (set during checkout)
        // Fallback: look up org by subscription_id for existing subscriptions
        let orgId = (metadata as Record<string, string>)?.organisation_id;

        if (!orgId) {
          // Look up org by subscription_id
          const org = await db
            .select()
            .from(organisations)
            .where(eq(organisations.subscription_id, subscription_id))
            .limit(1);

          if (org.length > 0) {
            orgId = org[0].id;
          }
        }

        if (!orgId) {
          console.error("Could not determine org ID from metadata or subscription lookup");
          return res.status(400).json({ error: "Could not determine organisation" });
        }

        try {
          switch (event.type) {
            case "subscription.active": {
              await subscriptionService.updateSubscriptionStatus(
                orgId,
                "active",
                subscription_id
              );
              break;
            }
            case "subscription.on_hold": {
              await subscriptionService.updateSubscriptionStatus(
                orgId,
                "on_hold"
              );
              break;
            }
            case "subscription.failed": {
              await subscriptionService.updateSubscriptionStatus(orgId, "failed");
              break;
            }
            case "subscription.cancelled": {
              await subscriptionService.updateSubscriptionStatus(
                orgId,
                "cancelled"
              );
              break;
            }
            case "subscription.renewed": {
              await subscriptionService.updateSubscriptionStatus(orgId, "active");
              break;
            }
            case "subscription.expired": {
              await subscriptionService.updateSubscriptionStatus(
                orgId,
                "expired"
              );
              break;
            }
          }

          return res.status(200).json({ success: true });
        } catch (error) {
          console.error(`Error processing subscription event ${event.type}:`, error);
          return res.status(500).json({ error: "Failed to process subscription event" });
        }
      }

      // For other event types, just acknowledge receipt
      console.log(`Received webhook event: ${event.type}`);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Create a checkout session URL for adding credits to wallet
   */
  router.post("/api/checkout/create", async (req: Request, res: Response) => {
    const { isAuthenticated, userId, orgId } = getAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const user = await clerkClient.users.getUser(userId!);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { amount, returnUrl } = req.body;

    // Validate amount
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        error: "Invalid amount. Amount must be a positive number in cents.",
      });
    }

    // Validate return URL
    if (!returnUrl || typeof returnUrl !== "string") {
      return res.status(400).json({
        error: "Invalid return URL. Return URL must be a string.",
      });
    }

    const organisationId = orgId ?? userId!;

    try {
      // Fetch organisation from database to get payment_id
      const org = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, organisationId))
        .limit(1);

      if (!org || org.length === 0) {
        return res.status(404).json({ error: "Organisation not found" });
      }

      // Create checkout session
      const checkoutSessionResponse = await dodoClient.checkoutSessions.create({
        product_cart: [{ product_id: PRODUCT_ID, quantity: 1, amount }],
        customer: {
          name: user?.fullName ?? "",
          email: user?.primaryEmailAddress?.emailAddress ?? "",
        },
        metadata: {
          organisation_id: organisationId,
          amount_usd_cents: amount.toString(),
        },
        return_url: returnUrl,
      });

      return res.json({
        success: true,
        checkoutUrl: checkoutSessionResponse.checkout_url,
        sessionId: checkoutSessionResponse.session_id,
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create checkout session",
      });
    }
  });

  /**
   * Create a subscription checkout session URL
   * Used for new subscriptions and resubscribing lapsed orgs
   */
  router.post(
    "/api/subscription/checkout",
    async (req: Request, res: Response) => {
      const { isAuthenticated, userId, orgId } = getAuth(req);

      if (!isAuthenticated) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const user = await clerkClient.users.getUser(userId!);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const { returnUrl } = req.body;

      // Validate return URL
      if (!returnUrl || typeof returnUrl !== "string") {
        return res.status(400).json({
          error: "Invalid return URL. Return URL must be a string.",
        });
      }

      const organisationId = orgId ?? userId!;

      try {
        // Get member count to determine addon seats
        const memberCount =
          await subscriptionService.getOrgMemberCount(organisationId);
        const addonSeats = subscriptionService.calculateAddonSeats(memberCount);

        // Generate customer email (used to link subscription to org)
        const customerEmail = `${organisationId}@customer.august.tech`;

        // Build addons array if needed
        const addons =
          addonSeats > 0
            ? [{ addon_id: ADDON_SEAT_PRODUCT_ID, quantity: addonSeats }]
            : undefined;

        // Create checkout session for subscription product
        // Note: Trial period is configured on the product in Dodo dashboard
        const checkoutResponse = await dodoClient.checkoutSessions.create({
          product_cart: [
            {
              product_id: SUBSCRIPTION_PRODUCT_ID,
              quantity: 1,
              addons,
            },
          ],
          customer: {
            name: user?.fullName ?? "",
            email: customerEmail,
          },
          return_url: returnUrl,
          metadata: {
            organisation_id: organisationId,
          },
        });

        return res.json({
          success: true,
          checkoutUrl: checkoutResponse.checkout_url,
          sessionId: checkoutResponse.session_id,
        });
      } catch (error) {
        console.error("Error creating subscription checkout:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to create subscription checkout",
        });
      }
    }
  );

  return router;
}
