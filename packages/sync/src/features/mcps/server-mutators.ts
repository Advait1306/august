import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../../zero/schema";
import type { AsyncTask, OAuthService } from "../types";

export function createMcpServerMutators(
  asyncTasks: AsyncTask,
  oauthService: OAuthService
) {
  return {
    mcps: {
      delete: defineMutator(
        z.object({
          mcp_id: z.string(),
        }),
        async ({ tx, ctx, args: { mcp_id } }) => {
          // Check if MCP belongs to user
          const mcp = await tx.run(
            builder.mcps
              .where("id", mcp_id)
              .where("author_id", ctx.userId)
              .one()
          );

          if (!mcp) {
            throw new Error("MCP not found or access denied");
          }

          if (mcp.integration_type === "oauth") {
            // Revoke OAuth token synchronously before deleting the connection
            try {
              // This will also delete the oauth token from the database
              await oauthService.revokeToken({ mcpId: mcp_id });
            } catch (error) {
              console.error(
                "[Server Mutator] Error revoking OAuth token:",
                error
              );
            }
          } else {
            const composioConnection = await tx.run(
              builder.mcpComposioConnections.where("mcp_id", mcp_id).one()
            );

            if (!composioConnection) {
              throw new Error("Composio connection not found");
            }

            // TODO: Figure out how to delete the Composio connection from composio SDK as well
            await tx.mutate.mcpComposioConnections.delete({
              id: composioConnection.id,
            });
          }

          // Delete the MCP from the database
          await tx.mutate.mcps.delete({ id: mcp_id });
        }
      ),
    },
  };
}
