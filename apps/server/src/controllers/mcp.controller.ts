import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { OAuthService } from "../services/oauth.service";
import { ComposioService } from "../services/composio.service";
import { McpService } from "../services/mcp.service";

export function createMCPController(
  oauthService: OAuthService,
  composioService: ComposioService,
  mcpService: McpService
): Router {
  const router = Router();

  /**
   * POST /api/mcp/authorize
   * Initiates OAuth or Composio flow for an MCP integration
   * Accepts either a template MCP (mcp_store_id) or custom MCP (custom_mcp_url + custom_mcp_name)
   * Routes to appropriate service based on integration type
   */
  router.post("/api/mcp/authorize", async (req: Request, res: Response) => {
    try {
      const { isAuthenticated, userId, orgId } = getAuth(req);

      if (!isAuthenticated || !userId || !orgId) {
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
          error:
            "Must provide either mcp_store_id OR both custom_mcp_url and custom_mcp_name",
        });
        return;
      }

      if (hasTemplateMcp && hasCustomMcp) {
        res.status(400).json({
          error: "Cannot provide both mcp_store_id and custom MCP details",
        });
        return;
      }

      // For template MCPs, check the integration type to route to the correct service
      if (hasTemplateMcp) {
        const store = await mcpService.getMcpStoreById(mcp_store_id!);

        if (!store) {
          res.status(404).json({ error: "MCP not found in store" });
          return;
        }

        // Route to Composio service if integration type is composio
        if (store.integration_type === "composio") {
          const result = await composioService.initiateComposioFlow({
            mcpStoreId: mcp_store_id!,
            userId: userId,
            organisationId: orgId,
          });

          res.json({
            authorizationUrl: result.redirectUrl,
          });
          return;
        }
      }

      // Default to OAuth flow for custom MCPs or OAuth template MCPs
      const result = await oauthService.initiateOAuthFlow({
        mcpStoreId: mcp_store_id,
        customMcpUrl: custom_mcp_url,
        customMcpName: custom_mcp_name,
        userId: userId,
        organisationId: orgId,
      });

      res.json({ authorizationUrl: result.authorizationUrl });
    } catch (error) {
      console.error("Error in /api/mcp/authorize:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * GET /api/mcp/callback
   * Unified callback handler for both OAuth and Composio flows
   * - OAuth: expects `code` and `state` query params
   * - Composio: expects `connected_account_id` query param
   * No authentication required for Composio (comes from browser redirect)
   */
  router.get("/api/mcp/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, connected_account_id } = req.query as {
        code?: string;
        state?: string;
        connected_account_id?: string;
      };

      // Determine which flow based on query params
      if (connected_account_id) {
        // Composio flow - no authentication needed
        console.log("[Callback] Handling Composio callback");

        const result = await composioService.handleComposioCallback({
          connectedAccountId: connected_account_id,
        });

        if (result.success) {
          // Redirect to frontend with success
          const redirectUrl =
            result.redirectUri ||
            `${process.env.WEB_URL}/integrations?status=success`;
          res.redirect(redirectUrl);
        } else {
          // Redirect to frontend with error
          const errorUrl =
            result.redirectUri ||
            `${process.env.WEB_URL}/integrations?status=error&message=${encodeURIComponent(result.error || "Unknown error")}`;
          res.redirect(errorUrl);
        }
      } else if (code && state) {
        // OAuth flow
        console.log("[Callback] Handling OAuth callback");

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
      } else {
        // Missing required parameters
        res.status(400).send("Missing required callback parameters");
        return;
      }
    } catch (error) {
      console.error("Error in /api/mcp/callback:", error);
      const errorUrl = `${process.env.WEB_URL}/integrations?status=error&message=${encodeURIComponent("Internal server error")}`;
      res.redirect(errorUrl);
    }
  });

  return router;
}
