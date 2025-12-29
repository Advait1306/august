import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { useZero } from "@/src/hooks/useZero";
import { mutators } from "@jupiter/sync/mutators/data";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

interface MCPCardProps {
  mcpStoreItem: {
    id: string;
    name: string;
    logo_url?: string | null;
    category?: string | null;
    description?: string | null;
  };
  connectedMcp?: {
    id: string;
    name: string;
    mcp_store_id: string;
  } | null;
}

export function MCPCard({ mcpStoreItem, connectedMcp }: MCPCardProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const z = useZero();
  const { getToken } = useAuth();

  const isConnected = !!connectedMcp;

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      // Get Clerk token
      const token = await getToken({
        template: "cc-proxy",
        skipCache: true,
      });

      if (!token) {
        toast.error("Authentication failed. Please try again.");
        return;
      }

      // Initiate OAuth flow (MCP will be created after successful OAuth callback)
      const response = await fetch(`${SERVER_URL}/api/mcp/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mcp_store_id: mcpStoreItem.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to connect to integration");
      }

      const { authorizationUrl } = await response.json();

      // Open OAuth URL in user's default browser
      window.api.browser.openUrl(authorizationUrl);

      toast.success("Opening authorization page...");
    } catch (error) {
      console.error("Error connecting to connection:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to connect to integration");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!connectedMcp) return;

    try {
      await z.mutate(mutators.mcps.delete({ mcp_id: connectedMcp.id })).client;
      toast.success("Integration disconnected successfully");
    } catch (error) {
      console.error("Failed to delete connection:", error);
      toast.error("Failed to disconnect integration");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-all border border-border">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
            {mcpStoreItem.logo_url ? (
              <img
                src={mcpStoreItem.logo_url}
                alt={mcpStoreItem.name}
                className="w-5 h-5"
              />
            ) : (
              <span className="text-sm">{mcpStoreItem.name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{mcpStoreItem.name}</p>
          </div>
        </div>

        <div className="shrink-0">
          {isConnecting ? (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-xs h-7 px-3"
              disabled
            >
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Connecting...
            </Button>
          ) : isConnected ? (
            <Popover modal={false}>
              <PopoverAnchor>
                <PopoverTrigger asChild>
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Connected
                  </Badge>
                </PopoverTrigger>
              </PopoverAnchor>
              <PopoverContent className="w-80" side="top" align="center">
                <div className="space-y-4">
                  <p className="text-sm">
                    Are you sure you want to disconnect {connectedMcp?.name}?
                  </p>
                  <div className="flex gap-2 justify-end">
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        Cancel
                      </Button>
                    </PopoverTrigger>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleConfirmDisconnect}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs h-7 px-4 bg-background hover:bg-muted"
              onClick={handleConnect}
            >
              Connect
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
