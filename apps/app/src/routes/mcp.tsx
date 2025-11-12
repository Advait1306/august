import { ShellOnly } from "@/components/restrictor";
import { createFileRoute } from "@tanstack/react-router";
import { useSyncContext } from "../components/sync_engine";
import { useQuery } from "@rocicorp/zero/react";
import { getMCPStore, getMCPs } from "@jupiter/sync/queries/data";
import { Button } from "@/components/ui/button";
import { useImageColor } from "@/src/hooks/useImageColor";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { fuzzyMatch } from "@/src/lib/fuzzy-match";
import { useMCPTools } from "@/src/contexts/mcp-runtime";
import { useZero } from "@/src/hooks/useZero";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
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
}

function MCPCard({ item, isConnected, isConnecting, onConnect }: MCPCardProps) {
  const { darkerColor, lighterColor } = useImageColor(item.logo_url!);

  return (
    <div
      className="h-[72px] flex flex-col justify-center relative border-1 rounded-xl bg-card hover:shadow-md transition-all overflow-hidden"
      style={{ borderColor: lighterColor ?? undefined }}
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
            variant={isConnected ? "outline" : "secondary"}
            size="sm"
            className="rounded-full text-[12px] !py-3 h-[28px]"
            onClick={onConnect}
            disabled={isConnected || isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Connecting...
              </>
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

interface ConnectedMCPCardProps {
  item: {
    id: string;
    name: string;
    logo_url?: string | null;
  };
  onClick?: () => void;
}

function ConnectedMCPCard({ item, onClick }: ConnectedMCPCardProps) {
  // Only extract colors if we have a logo
  const { darkerColor, lighterColor } = useImageColor(item.logo_url || "");

  // Use default colors for custom MCPs without logos
  const bgColor = item.logo_url ? darkerColor : "#e0e0e0";
  const borderColor = item.logo_url ? lighterColor : "#d0d0d0";

  return (
    <div
      className="w-[72px] h-[72px] flex items-center justify-center relative border-1 rounded-xl bg-card hover:shadow-md transition-all overflow-hidden cursor-pointer"
      style={{ borderColor: borderColor ?? undefined }}
      onClick={onClick}
    >
      {/* Blurred background effect */}
      <div
        className="w-full h-full absolute top-0 left-0 opacity-20 blur-xl"
        style={{
          backgroundColor: bgColor ?? undefined,
          scale: "4",
        }}
      />

      {/* Icon or first letter */}
      {item.logo_url ? (
        <img
          src={item.logo_url}
          alt={item.name}
          className="w-10 h-10 rounded relative z-10"
        />
      ) : (
        <div className="relative z-10 text-4xl font-medium">
          {item.name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

interface MCPInfoCardProps {
  name: string;
  logo_url?: string | null;
  onDisconnect: () => void;
}

function MCPInfoCard({ name, logo_url, onDisconnect }: MCPInfoCardProps) {
  const { darkerColor, lighterColor } = useImageColor(logo_url || "");
  const bgColor = logo_url ? darkerColor : "#e0e0e0";
  const borderColor = logo_url ? lighterColor : "#d0d0d0";

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative border rounded-xl bg-card overflow-hidden p-6"
      style={{ borderColor: borderColor ?? undefined }}
    >
      {/* Blurred background effect */}
      <div
        className="w-full h-full absolute top-0 left-0 opacity-20 blur-xl"
        style={{
          backgroundColor: bgColor ?? undefined,
          scale: "4",
        }}
      />

      {/* Icon or first letter */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        {logo_url ? (
          <img src={logo_url} alt={name} className="w-20 h-20 rounded" />
        ) : (
          <div className="text-6xl font-medium">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <h2 className="font-semibold text-lg text-center">{name}</h2>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDisconnect}
          className="mt-2"
        >
          Disconnect
        </Button>
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
  const mcpTools = useMCPTools();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMcpId, setSelectedMcpId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Create a set of connected MCP store IDs
  const connectedMcpStoreIds = useMemo(() => {
    return new Set(userMcps.map((mcp) => mcp.mcp_store_id).filter(Boolean));
  }, [userMcps]);

  // Filter mcpStore based on search query
  const filteredMcpStore = useMemo(() => {
    if (!searchQuery) return mcpStore;
    return mcpStore.filter((item) => fuzzyMatch(item.name, searchQuery));
  }, [mcpStore, searchQuery]);

  // Get selected MCP details
  const selectedMcp = useMemo(() => {
    if (!selectedMcpId) return null;
    return userMcps.find((mcp) => mcp.id === selectedMcpId);
  }, [selectedMcpId, userMcps]);

  // Get selected MCP logo from store
  const selectedMcpLogo = useMemo(() => {
    if (!selectedMcp) return null;
    const storeListing = mcpStore.find(
      (store) => store.id === selectedMcp.mcp_store_id
    );
    return storeListing?.logo_url || null;
  }, [selectedMcp, mcpStore]);

  // Get tools for selected MCP
  const selectedMcpTools = useMemo(() => {
    if (!selectedMcpId) return [];
    return mcpTools.get(selectedMcpId) || [];
  }, [selectedMcpId, mcpTools]);

  const handleDisconnectClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedMcpId) return;

    try {
      await z.mutate.mcps.delete({ mcp_id: selectedMcpId });
      setShowDeleteConfirm(false);
      setSelectedMcpId(null);
    } catch (error) {
      console.error("Failed to delete MCP:", error);
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
        {/* User's MCPs */}
        {userMcps.length > 0 && (
          <>
            <div className="bg-background p-4 w-full max-w-[1200px] mx-auto flex flex-col gap-2">
              <div className="flex flex-wrap gap-3">
                {userMcps.map((mcp) => {
                  // Find the store listing to get the logo
                  const storeListing = mcpStore.find(
                    (store) => store.id === mcp.mcp_store_id
                  );

                  return (
                    <ConnectedMCPCard
                      key={mcp.id}
                      item={{
                        id: mcp.id,
                        name: mcp.name,
                        logo_url: storeListing?.logo_url || null,
                      }}
                      onClick={() => setSelectedMcpId(mcp.id)}
                    />
                  );
                })}
              </div>
            </div>
            <Separator />
          </>
        )}
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
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* MCP Tools Dialog */}
        <Dialog
          open={!!selectedMcpId}
          onOpenChange={() => setSelectedMcpId(null)}
        >
          <DialogContent className="!w-full !max-w-[800px] h-[400px] p-0 overflow-hidden rounded-3xl">
            <div className="h-full overflow-hidden flex flex-row p-4 gap-4">
              {/* Left side - MCP Info (flex-2) */}
              <div className="h-full flex-2">
                {selectedMcp && (
                  <MCPInfoCard
                    name={selectedMcp.name}
                    logo_url={selectedMcpLogo}
                    onDisconnect={handleDisconnectClick}
                  />
                )}
              </div>

              {/* Right side - Tools (flex-5) */}
              <div className="flex-[5] h-full overflow-scroll overflow-y-auto bg-muted/20">
                <h3 className="text-lg font-semibold mb-4">Tools</h3>
                {selectedMcpTools.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No tools available or still loading...</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedMcpTools.map((tool) => (
                      <Badge key={tool.name} variant="outline">
                        {tool.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog for Disconnect */}
        <AlertDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will disconnect and remove the MCP integration "
                {selectedMcp?.name}". This action cannot be undone.
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
