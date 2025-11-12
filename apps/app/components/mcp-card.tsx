import { Button } from "@/components/ui/button";
import { useImageColor } from "@/src/hooks/useImageColor";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useZero } from "@/src/hooks/useZero";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";
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
  const { darkerColor, lighterColor } = useImageColor(mcpStoreItem.logo_url!);
  const [isHovered, setIsHovered] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

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
      console.error("Error connecting to MCP:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to connect to integration");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectClick = () => {
    setShowDisconnectDialog(true);
  };

  const handleConfirmDisconnect = async () => {
    if (!connectedMcp) return;

    try {
      await z.mutate.mcps.delete({ mcp_id: connectedMcp.id });
      setShowDisconnectDialog(false);
      toast.success("Integration disconnected successfully");
    } catch (error) {
      console.error("Failed to delete MCP:", error);
      toast.error("Failed to disconnect integration");
    }
  };

  return (
    <>
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
            {mcpStoreItem.logo_url && (
              <img
                src={mcpStoreItem.logo_url}
                alt={mcpStoreItem.name}
                className="w-10 h-10 rounded"
              />
            )}
            <div className="flex-1 min-w-0 flex flex-col">
              <h3 className="font-semibold truncate">{mcpStoreItem.name}</h3>
              {mcpStoreItem.category && (
                <span className="text-xs line-clamp-1">
                  {mcpStoreItem.description}
                </span>
              )}
            </div>
          </div>

          <div>
            <Button
              variant={
                isConnected && isHovered
                  ? "destructive"
                  : isConnected
                    ? "ghost"
                    : "secondary"
              }
              size="sm"
              className="rounded-full text-[12px] !py-3 h-[28px] border"
              style={
                isConnected && !isHovered
                  ? { borderColor: lighterColor ?? undefined }
                  : undefined
              }
              onClick={isConnected ? handleDisconnectClick : handleConnect}
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

      {/* Confirmation Dialog for Disconnect */}
      <AlertDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect and remove the MCP integration "
              {connectedMcp?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
