import { Request, Response, Router } from "express";
import { ClerkClient, getAuth } from "@clerk/express";
import type DodoPayments from "dodopayments";
import { eq } from "drizzle-orm";
import { organisations } from "@jupiter/sync/db/schema";
import { Webhook } from "standardwebhooks";
import {
  SubscriptionService,
  SubscriptionStatus,
  SUBSCRIPTION_PRODUCT_ID,
  ADDON_SEAT_PRODUCT_ID,
} from "../services/subscription.service";
import { AppState } from "../config/state";

export function createBillingController(
  clerkClient: ClerkClient,
  db: AppState["db"],
  dodoClient: DodoPayments,
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
          metadata?: {
            organisation_id?: string;
          };
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

      // Handle subscription events
      if (event.type.startsWith("subscription.")) {
        const { subscription_id, metadata } = event.data;

        if (!subscription_id) {
          console.error("No subscription_id in webhook payload");
          return res.status(400).json({ error: "Missing subscription_id" });
        }

        // Get organisation ID from metadata (set during checkout)
        // Fallback: look up org by subscription_id for existing subscriptions
        let orgId =
          metadata && typeof metadata === "object"
            ? (metadata as Record<string, string>)?.organisation_id
            : undefined;

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
