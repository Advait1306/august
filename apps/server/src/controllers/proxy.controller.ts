import { Request, Response, Router } from "express";
import { getAuth } from "@clerk/express";
import { ProxyService } from "../services/proxy.service";
import { BillingService } from "../services/billing.service";
import { OAuthService } from "../services/oauth.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { mcps, mcpOauthIntegrationDetails } from "@jupiter/sync/db/schema";

export function createProxyController(
  proxyService: ProxyService,
  billingService: BillingService,
  oauthService: OAuthService,
  db: NodePgDatabase
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

  /**
   * Proxy requests to MCP servers with OAuth token replacement
   * Route: /proxy/mcp/:mcpId/*
   */
  router.all(
    "/proxy/mcp/:mcpId/{*path}",
    async (req: Request, res: Response) => {
      const { isAuthenticated, userId, orgId } = getAuth(req);

      if (!isAuthenticated || !userId) {
        console.log("[MCP Proxy] Authentication failed");
        return res.status(401).json({ error: "User not authenticated" });
      }

      const organisationId = orgId ?? userId;
      const { mcpId } = req.params;
      // Extract the path after /proxy/mcp/:mcpId/
      const path = req.path.replace(`/proxy/mcp/${mcpId}/`, "");

      console.log("[MCP Proxy] Incoming request:", {
        method: req.method,
        mcpId,
        path,
        fullPath: req.path,
        userId,
        organisationId,
      });

      try {
        // Fetch the MCP configuration
        const [mcp] = await db
          .select()
          .from(mcps)
          .where(
            and(
              eq(mcps.id, mcpId),
              eq(mcps.author_id, userId),
              eq(mcps.organisation_id, organisationId)
            )
          )
          .limit(1);

        if (!mcp) {
          console.log("[MCP Proxy] MCP not found:", { mcpId, userId, organisationId });
          return res
            .status(404)
            .json({ error: "MCP not found or access denied" });
        }

        // Determine MCP server URL (either from store or custom)
        let mcpServerUrl: string;

        if (mcp.mcp_store_id) {
          // Store MCP - fetch OAuth integration details to get the MCP server URL
          const [oauthDetails] = await db
            .select()
            .from(mcpOauthIntegrationDetails)
            .where(eq(mcpOauthIntegrationDetails.mcp_store_id, mcp.mcp_store_id))
            .limit(1);

          if (!oauthDetails) {
            console.log("[MCP Proxy] OAuth integration details not found for MCP:", { mcpId });
            return res
              .status(404)
              .json({ error: "OAuth integration details not found" });
          }

          mcpServerUrl = oauthDetails.mcp_server_url;
        } else if (mcp.custom_mcp_server_url) {
          // Custom MCP - use the URL from the mcp record
          mcpServerUrl = mcp.custom_mcp_server_url;
        } else {
          console.log("[MCP Proxy] MCP has no server URL:", { mcpId });
          return res
            .status(500)
            .json({ error: "MCP configuration error: no server URL" });
        }

        console.log("[MCP Proxy] MCP found:", {
          mcpId,
          mcpServerUrl,
          isCustom: !mcp.mcp_store_id,
        });

        // Get the OAuth access token (will auto-refresh if expired)
        const accessToken = await oauthService.getAccessToken({
          mcpId,
        });

        if (!accessToken) {
          console.log("[MCP Proxy] No access token found for MCP:", { mcpId });
          return res.status(401).json({
            error: "OAuth connection not found or token refresh failed",
          });
        }

        console.log("[MCP Proxy] Access token retrieved, forwarding request to:", {
          targetUrl: mcpServerUrl,
          path,
        });

        // Forward the request to the MCP server
        await proxyService.forwardToMCP(
          mcpServerUrl,
          accessToken,
          req,
          res,
          path
        );

        console.log("[MCP Proxy] Request forwarded successfully");
      } catch (error) {
        console.error("[MCP Proxy] Error handling MCP proxy request:", error);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ error: "Failed to forward request to MCP server" });
        }
      }
    }
  );

  return router;
}
