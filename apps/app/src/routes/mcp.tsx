import { ShellOnly } from "@/components/restrictor";
import { createFileRoute } from "@tanstack/react-router";
import { useSyncContext } from "../components/sync_engine";
import { useQuery } from "@rocicorp/zero/react";
import { getMCPStore, getMCPs } from "@jupiter/sync/queries/data";
import { Button } from "@/components/ui/button";
import { ExternalLink, Check, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useApi } from "@/src/lib/api";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/mcp")({
  component: MCP,
});

function MCP() {
  const syncContext = useSyncContext();
  const mcpStore = useQuery(getMCPStore(syncContext.authData))[0];
  const userMcps = useQuery(getMCPs(syncContext.authData))[0];
  const api = useApi();
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Create a map of connected MCP store IDs for quick lookup
  const connectedMcpStoreIds = new Set(
    userMcps.filter((mcp) => mcp.mcp_store_id).map((mcp) => mcp.mcp_store_id)
  );

  const handleConnect = async (mcpStoreId: string) => {
    try {
      setConnectingId(mcpStoreId);

      // Initiate OAuth flow (MCP will be created after successful OAuth callback)
      const authorizeResponse = await api.post("/api/oauth/authorize", {
        mcp_store_id: mcpStoreId,
      });

      const { authorizationUrl } = authorizeResponse.data;

      // Open OAuth URL in user's default browser
      window.api.browser.openUrl(authorizationUrl);

      toast.success("Opening authorization page...");
    } catch (error) {
      console.error("Error connecting to MCP:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to connect to integration");
      }
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <ShellOnly>
      <div className="flex flex-col">
        <div className="p-4 flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            MCP Integrations
          </h1>
          <span className="text-muted-foreground">
            Connect Model Context Protocol integrations to extend capabilities.
          </span>
        </div>

        <Separator />

        {/* MCP Store */}
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-4">Available Integrations</h2>

          {mcpStore.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No integrations available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mcpStore.map((item) => {
                const isConnected = connectedMcpStoreIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="border border-card-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      {item.logo_url && (
                        <img
                          src={item.logo_url}
                          alt={item.name}
                          className="w-10 h-10 rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">
                            {item.name}
                          </h3>
                          {isConnected && (
                            <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                        {item.category && (
                          <span className="text-xs text-muted-foreground">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-4 flex gap-2">
                      {isConnected ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Connected
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleConnect(item.id)}
                          disabled={connectingId === item.id}
                        >
                          {connectingId === item.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect"
                          )}
                        </Button>
                      )}
                      {item.mcp_server_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            window.open(item.mcp_server_url, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* User's MCPs */}
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-4">My Connections</h2>

          {userMcps.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No integrations connected yet
              </p>
              <p className="text-sm text-muted-foreground">
                Connect to an integration above to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {userMcps.map((mcp) => (
                <div
                  key={mcp.id}
                  className="border border-card-border rounded-lg p-4 bg-card"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{mcp.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {mcp.mcp_store_id
                          ? "Store Integration"
                          : "Custom Integration"}
                      </p>
                      {mcp.custom_description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {mcp.custom_description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(mcp.mcp_server_url, "_blank")
                        }
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ShellOnly>
  );
}
