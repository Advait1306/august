import { Request, Response, Router } from "express";
import { Webhook } from "svix";
import { getAuth } from "@clerk/express";
import { ClerkService } from "../services/clerk.service";
import { SubscriptionService } from "../services/subscription.service";

export function createClerkController(
  clerkService: ClerkService,
  subscriptionService: SubscriptionService
): Router {
  const router = Router();
  const wh = new Webhook(process.env.CLERK_WEBHOOK_KEY!);

  /**
   * Clerk webhook handler
   */
  router.post("/clerk", async (req: Request, res: Response) => {
    const payload = req.body;
    const headers = req.headers as Record<string, string>;

    interface ClerkWebhookPayload {
      type: string;
      data: {
        id: string;
        organization?: {
          id: string;
          members_count?: number;
        };
      };
    }

    let parsedPayload: ClerkWebhookPayload;
    try {
      wh.verify(payload, headers);
      // Handle both raw body (production with rawBody middleware) and parsed JSON (tests)
      parsedPayload = (
        typeof payload === "object" && !Buffer.isBuffer(payload)
          ? payload
          : JSON.parse(
              Buffer.isBuffer(payload) ? payload.toString() : String(payload)
            )
      ) as ClerkWebhookPayload;
    } catch (err) {
      console.error("Clerk Webhook verification failed:", err);
      return res.sendStatus(400);
    }

    switch (parsedPayload.type) {
      case "user.created": {
        await clerkService.createUser(parsedPayload.data.id);
        res.sendStatus(200);
        break;
      }

      case "user.deleted": {
        await clerkService.deleteUser(parsedPayload.data.id);
        res.sendStatus(200);
        break;
      }

      case "organization.created": {
        await clerkService.createOrganisation(parsedPayload.data.id);
        res.sendStatus(200);
        break;
      }

      case "organization.deleted": {
        await clerkService.deleteOrganisation(parsedPayload.data.id);
        res.sendStatus(200);
        break;
      }

      case "organizationMembership.created":
      case "organizationMembership.deleted": {
        // Extract org ID and member count from the payload
        const orgId = parsedPayload.data.organization?.id;
        const membersCount = parsedPayload.data.organization?.members_count;

        if (!orgId) {
          console.error("No organization ID in membership webhook payload");
          return res.sendStatus(400);
        }

        // Ensure org exists (handles out-of-order webhook events)
        await clerkService.createOrganisation(orgId);

        await subscriptionService.handleMemberChange(orgId, membersCount);
        res.sendStatus(200);
        break;
      }

      default: {
        // Return 200 for unhandled events to acknowledge receipt
        console.log(`Unhandled Clerk webhook event: ${parsedPayload.type}`);
        res.sendStatus(200);
        break;
      }
    }
  });

  /**
   * Generate Clerk sign-in ticket
   */
  router.get("/ticket", async (req: Request, res: Response) => {
    const { isAuthenticated, userId } = getAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const ticket = await clerkService.generateSignInToken(userId!);
      return res.status(200).json({ ticket });
    } catch (error) {
      console.error("Failed to generate ticket:", error);
      return res.status(500).json({ error: "Failed to generate token" });
    }
  });

  return router;
}
