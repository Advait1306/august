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
   * Handles registration automatically if needed
   */
  router.post("/api/oauth/authorize", async (req: Request, res: Response) => {
    try {
      const { isAuthenticated, userId, orgId } = getAuth(req);

      if (!isAuthenticated || !userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { mcp_id, mcp_server_url, redirect_uri } = req.body as {
        mcp_id?: string;
        mcp_server_url?: string;
        redirect_uri?: string;
      };

      if (!mcp_id || !mcp_server_url) {
        res.status(400).json({ error: "mcp_id and mcp_server_url are required" });
        return;
      }

      const result = await oauthService.initiateOAuthFlow({
        mcpId: mcp_id,
        mcpServerUrl: mcp_server_url,
        userId: userId,
        organisationId: orgId ?? userId,
        redirectUri: redirect_uri,
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
   * GET /api/oauth/callback/:mcp_id
   * Handles OAuth callback from the provider
   */
  router.get(
    "/api/oauth/callback/:mcp_id",
    async (req: Request, res: Response) => {
      try {
        const { mcp_id } = req.params;
        const { code, state } = req.query as { code?: string; state?: string };

        if (!code || !state) {
          res.status(400).send("Missing code or state parameter");
          return;
        }

        const result = await oauthService.handleOAuthCallback({
          mcpId: mcp_id,
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
