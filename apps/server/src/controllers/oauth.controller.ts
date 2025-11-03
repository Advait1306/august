import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { OAuthService } from "../services/oauth.service";

export function createOAuthController(db: NodePgDatabase): Router {
  const router = Router();
  const oauthService = new OAuthService(db);

  /**
   * POST /api/oauth/authorize
   * Initiates OAuth flow for an MCP integration
   * Accepts either a template MCP (mcp_store_id) or custom MCP (custom_mcp_url + custom_mcp_name)
   */
  router.post("/api/oauth/authorize", async (req: Request, res: Response) => {
    try {
      const { isAuthenticated, userId, orgId } = getAuth(req);

      if (!isAuthenticated || !userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { mcp_store_id, custom_mcp_url, custom_mcp_name } = req.body as {
        mcp_store_id?: string;
        custom_mcp_url?: string;
        custom_mcp_name?: string;
      };

      // Validate: must provide either template or custom MCP
      const hasTemplateMcp = !!mcp_store_id;
      const hasCustomMcp = !!custom_mcp_url && !!custom_mcp_name;

      if (!hasTemplateMcp && !hasCustomMcp) {
        res.status(400).json({
          error: "Must provide either mcp_store_id OR both custom_mcp_url and custom_mcp_name"
        });
        return;
      }

      if (hasTemplateMcp && hasCustomMcp) {
        res.status(400).json({
          error: "Cannot provide both mcp_store_id and custom MCP details"
        });
        return;
      }

      const result = await oauthService.initiateOAuthFlow({
        mcpStoreId: mcp_store_id,
        customMcpUrl: custom_mcp_url,
        customMcpName: custom_mcp_name,
        userId: userId,
        organisationId: orgId ?? userId,
      });

      res.json(result);
    } catch (error) {
      console.error("Error in /api/oauth/authorize:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * GET /api/oauth/callback
   * Handles OAuth callback from the provider
   * Creates the MCP and OAuth connection after successful authorization
   */
  router.get(
    "/api/oauth/callback",
    async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query as { code?: string; state?: string };

        if (!code || !state) {
          res.status(400).send("Missing code or state parameter");
          return;
        }

        const result = await oauthService.handleOAuthCallback({
          code,
          state,
        });

        if (result.success) {
          // Redirect to frontend with success
          const redirectUrl =
            result.redirectUri ||
            `${process.env.WEB_URL}/integrations?status=success`;
          res.redirect(redirectUrl);
        } else {
          // Redirect to frontend with error
          const errorUrl = `${process.env.WEB_URL}/integrations?status=error&message=${encodeURIComponent(result.error || "Unknown error")}`;
          res.redirect(errorUrl);
        }
      } catch (error) {
        console.error("Error in /api/oauth/callback:", error);
        const errorUrl = `${process.env.WEB_URL}/integrations?status=error&message=${encodeURIComponent("Internal server error")}`;
        res.redirect(errorUrl);
      }
    }
  );

  return router;
}
