import { ShellOnly } from "@/components/restrictor";
import { createFileRoute } from "@tanstack/react-router";
import { useSyncContext } from "../components/sync_engine";
import { useQuery } from "@rocicorp/zero/react";
import { getMCPStore, getMCPs } from "@jupiter/sync/queries/data";
import { Button } from "@/components/ui/button";
import { useImageColor } from "@/src/hooks/useImageColor";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { fuzzyMatch } from "@/src/lib/fuzzy-match";
import { useZero } from "@/src/hooks/useZero";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

export const Route = createFileRoute("/mcp")({
  component: MCP,
});

interface MCPCardProps {
  item: {
    id: string;
    name: string;
    logo_url?: string | null;
    category?: string | null;
    description?: string | null;
  };
  isConnected?: boolean;
  isConnecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

function MCPCard({
  item,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
}: MCPCardProps) {
  const { darkerColor, lighterColor } = useImageColor(item.logo_url!);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="h-[72px] flex flex-col justify-center relative border-1 rounded-xl bg-card hover:shadow-md transition-all overflow-hidden"
      style={{ borderColor: lighterColor ?? undefined }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Blurred background effect */}

      <div
        className="w-full h-full absolute top-0 left-0 opacity-20 blur-xl"
        style={{
          backgroundColor: darkerColor ?? undefined,
          scale: "4",
        }}
      />

      <div className="flex items-center justify-between gap-3 relative z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          {item.logo_url && (
            <img
              src={item.logo_url}
              alt={item.name}
              className="w-10 h-10 rounded"
            />
          )}
          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="font-semibold truncate">{item.name}</h3>
            {item.category && (
              <span className="text-xs line-clamp-1">{item.description}</span>
            )}
          </div>
        </div>

        <div>
          <Button
            variant={
              isConnected && isHovered ? "destructive" : isConnected ? "ghost" : "secondary"
            }
            size="sm"
            className="rounded-full text-[12px] !py-3 h-[28px] border"
            style={
              isConnected && !isHovered
                ? { borderColor: lighterColor ?? undefined }
                : undefined
            }
            onClick={isConnected ? onDisconnect : onConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Connecting...
              </>
            ) : isConnected && isHovered ? (
              "Disconnect"
            ) : isConnected ? (
              "Connected"
            ) : (
              "Connect"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MCP() {
  const syncContext = useSyncContext();
  const z = useZero();
  const { getToken } = useAuth();
  const mcpStore = useQuery(getMCPStore(syncContext.authData))[0];
  const userMcps = useQuery(getMCPs(syncContext.authData))[0];
  const [searchQuery, setSearchQuery] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnectingMcp, setDisconnectingMcp] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Create a set of connected MCP store IDs
  const connectedMcpStoreIds = useMemo(() => {
    return new Set(userMcps.map((mcp) => mcp.mcp_store_id).filter(Boolean));
  }, [userMcps]);

  // Filter mcpStore based on search query
  const filteredMcpStore = useMemo(() => {
    if (!searchQuery) return mcpStore;
    return mcpStore.filter((item) => fuzzyMatch(item.name, searchQuery));
  }, [mcpStore, searchQuery]);

  const handleDisconnectClick = (mcpStoreId: string) => {
    // Find the MCP to disconnect
    const mcp = userMcps.find((m) => m.mcp_store_id === mcpStoreId);
    if (mcp) {
      setDisconnectingMcp({ id: mcp.id, name: mcp.name });
    }
  };

  const handleConfirmDelete = async () => {
    if (!disconnectingMcp) return;

    try {
      await z.mutate.mcps.delete({ mcp_id: disconnectingMcp.id });
      setDisconnectingMcp(null);
      toast.success("Integration disconnected successfully");
    } catch (error) {
      console.error("Failed to delete MCP:", error);
      toast.error("Failed to disconnect integration");
    }
  };

  const handleConnect = async (mcpStoreId: string) => {
    try {
      setConnectingId(mcpStoreId);

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
          mcp_store_id: mcpStoreId,
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
      <div className="flex flex-col justify-start items-start">
        {/* MCP Store */}
        <div className="mt-6 p-4 w-full max-w-[1200px] mx-auto flex flex-col items-center gap-6">
          {/* Banner */}
          {userMcps.length === 0 && (
            <div className="relative w-full max-w-[1200px] h-[350px] flex flex-row items-center gap-2 border border-border rounded-xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full flex flex-col items-start justify-end z-2 p-8 gap-4">
                <h1 className="text-4xl font-medium text-white tracking-tighter ">
                  What are connections?
                </h1>
                <p className="text-white/80 min-w-[400px] w-[30%] whitespace-pre-wrap">
                  Connections allow you to give your AI access to external tools
                  and information.
                </p>
              </div>
              <img
                src="/connection-image.jpg"
                className="w-full h-full object-cover z-1 blur scale-130"
              />
            </div>
          )}
          {/* Search Bar */}
          <Input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />

          {mcpStore.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No integrations available yet.</p>
            </div>
          ) : filteredMcpStore.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No integrations match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMcpStore.map((item) => {
                const isConnected = connectedMcpStoreIds.has(item.id);
                const isConnecting = connectingId === item.id;

                return (
                  <MCPCard
                    key={item.id}
                    item={item}
                    isConnected={isConnected}
                    isConnecting={isConnecting}
                    onConnect={() => handleConnect(item.id)}
                    onDisconnect={() => handleDisconnectClick(item.id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmation Dialog for Disconnect */}
        <AlertDialog
          open={!!disconnectingMcp}
          onOpenChange={() => setDisconnectingMcp(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will disconnect and remove the MCP integration "
                {disconnectingMcp?.name}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ShellOnly>
  );
}
