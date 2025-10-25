import { Request, Response, Router } from "express";
import { ClerkClient, getAuth } from "@clerk/express";
import type DodoPayments from "dodopayments";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { organisations } from "@jupiter/sync/db/schema";

const PRODUCT_ID = "pdt_CyV6Fvwt5AjgHg49qI6qc";

export function createBillingController(
  clerkClient: ClerkClient,
  db: NodePgDatabase,
  dodoClient: DodoPayments
): Router {
  const router = Router();

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

      const paymentId = org[0].payment_id;

      if (!paymentId) {
        return res.status(400).json({
          error:
            "No payment ID found for this organisation. Please contact support.",
        });
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

  return router;
}
