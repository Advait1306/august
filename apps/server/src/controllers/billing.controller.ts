import { Router } from "express";
import { getAuth } from "@clerk/express";
import { DodoWebhookService } from "../services/dodo-webhook.service";
import { BillingService } from "../services/billing.service";
import { SubscriptionService } from "../services/subscription.service";

export function createBillingController(
  dodoWebhookService: DodoWebhookService,
  billingService: BillingService,
  subscriptionService: SubscriptionService
): Router {
  const router = Router();

  /**
   * DodoPayments webhook endpoint
   */
  router.post("/api/webhooks/dodo", async (req, res) => {
    try {
      const event = await dodoWebhookService.verifyAndParseWebhook(
        req.body.toString(),
        {
          webhookId: req.headers["webhook-id"] as string,
          webhookSignature: req.headers["webhook-signature"] as string,
          webhookTimestamp: req.headers["webhook-timestamp"] as string,
        }
      );
      await dodoWebhookService.handleWebhookEvent(event, subscriptionService);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Webhook error:", error);
      return res
        .status(
          (error as Error).message.includes("signature") ? 401 : 500
        )
        .json({ error: (error as Error).message });
    }
  });

  /**
   * Create a subscription checkout session URL
   * Used for new subscriptions and resubscribing lapsed orgs
   */
  router.post("/api/subscription/checkout", async (req, res) => {
    const { isAuthenticated, userId, orgId } = getAuth(req);
    if (!isAuthenticated || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { returnUrl } = req.body;
    if (!returnUrl || typeof returnUrl !== "string") {
      return res.status(400).json({ error: "returnUrl is required" });
    }

    const organisationId = orgId ?? userId;

    // Get member count from subscriptionService
    const memberCount =
      await subscriptionService.getOrgMemberCount(organisationId);

    const result = await billingService.createCheckoutSession({
      userId,
      organisationId,
      returnUrl,
      memberCount,
    });

    return res.json(result);
  });

  return router;
}
