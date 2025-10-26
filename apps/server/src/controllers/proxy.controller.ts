import { Request, Response, Router } from "express";
import { getAuth } from "@clerk/express";
import { ProxyService } from "../services/proxy.service";
import { BillingService } from "../services/billing.service";

export function createProxyController(
  proxyService: ProxyService,
  billingService: BillingService
): Router {
  const router = Router();

  /**
   * Proxy requests to Anthropic API
   */
  router.post("/cc-proxy/v1/messages", async (req: Request, res: Response) => {
    const { isAuthenticated, userId, orgId } = getAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const organisationId = orgId ?? userId!;

    // Check organisation wallet balance
    const walletCheck = await billingService.checkWalletBalance(organisationId);

    if (!walletCheck.success) {
      if (walletCheck.error === "Organisation not found") {
        return res.status(404).json({ error: walletCheck.error });
      }
      return res.status(402).json({ error: walletCheck.error });
    }

    try {
      await proxyService.forwardToAnthropic(
        req.body,
        req.headers["anthropic-version"] as string,
        res,
        organisationId
      );
    } catch (error) {
      console.error("Error forwarding request to Anthropic:", error);
      res.status(500).json({ error: "Failed to forward request" });
    }
  });

  return router;
}
