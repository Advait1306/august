import { useSyncContext } from "../src/components/sync_engine";
import { useQuery } from "@rocicorp/zero/react";
import { getMCPStore, getMCPs } from "@jupiter/sync/queries/data";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { fuzzyMatch } from "@/src/lib/fuzzy-match";
import { MCPCard } from "@/components/mcp-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useZero } from "@/src/hooks/useZero";
import { toast } from "sonner";
import { motion } from "motion/react";

export function MCPContent() {
  const syncContext = useSyncContext();
  const mcpStore = useQuery(getMCPStore(syncContext.authData))[0];
  const userMcps = useQuery(getMCPs(syncContext.authData))[0];
  const [searchQuery, setSearchQuery] = useState("");
  const z = useZero();

  // Create a map of connected MCPs by store ID for quick lookup
  const connectedMcpsByStoreId = useMemo(() => {
    const map = new Map();
    userMcps.forEach((mcp) => {
      if (mcp.mcp_store_id) {
        map.set(mcp.mcp_store_id, mcp);
      }
    });
    return map;
  }, [userMcps]);

  // Filter mcpStore based on search query
  const filteredMcpStore = useMemo(() => {
    if (!searchQuery) return mcpStore;
    return mcpStore.filter((item) => fuzzyMatch(item.name, searchQuery));
  }, [mcpStore, searchQuery]);

  const handleDeleteMcp = async (mcpId: string, mcpName: string) => {
    try {
      await z.mutate.mcps.delete({ mcp_id: mcpId });
      toast.success(`${mcpName} disconnected successfully`);
    } catch (error) {
      console.error("Failed to delete connection:", error);
      toast.error("Failed to disconnect connection");
    }
  };

  return (
    <div className="flex flex-col justify-start items-start h-full w-full overflow-auto">
      {/* Content with padding */}
      <div className="w-full px-6 py-6 pt-10">
        <div className="w-full max-w-[1000px] mx-auto flex flex-col gap-6">
          {/* Banner */}
          {userMcps.length === 0 && (
            <div className="relative w-full h-[350px] flex flex-row items-center gap-2 border border-border rounded-xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full flex flex-col items-start justify-end z-2 p-8 gap-4">
                <h1 className="text-4xl font-medium text-white tracking-tighter">
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
        </div>
      </div>

      {/* Search bar section with fixed height */}
      <div className="w-full h-[200px] flex items-center justify-center px-6">
        <Input
          type="text"
          placeholder="Search connections"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-[800px] rounded-xl p-4 h-16 border border-neutral-300 dark:border-neutral-700"
        />
      </div>

      {/* Active Connections Section */}
      {userMcps.length > 0 && (
        <div className="w-full max-w-[1000px] mx-auto flex flex-col mb-10">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 block">
            Active Connections
          </span>
          <div className="flex flex-wrap gap-2">
            {userMcps.map((mcp) => {
              const storeItem = mcpStore.find(
                (item) => item.id === mcp.mcp_store_id
              );
              return (
                <Popover key={mcp.id} modal={false}>
                  <PopoverAnchor>
                    <motion.div
                      initial={false}
                      whileHover="hover"
                      className="inline-flex"
                    >
                      <PopoverTrigger asChild>
                        <Badge
                          variant="outline"
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background cursor-pointer"
                        >
                          {storeItem?.logo_url && (
                            <img
                              src={storeItem.logo_url}
                              alt={mcp.name}
                              className="w-4 h-4"
                            />
                          )}
                          <span className="text-sm font-medium">
                            {mcp.name}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </Badge>
                      </PopoverTrigger>
                    </motion.div>
                  </PopoverAnchor>
                  <PopoverContent className="w-80" side="bottom" align="center">
                    <div className="space-y-4">
                      <span className="text-sm block">
                        Are you sure you want to disconnect {mcp.name}?
                      </span>
                      <div className="flex gap-2 justify-end">
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            Cancel
                          </Button>
                        </PopoverTrigger>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteMcp(mcp.id, mcp.name)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
        </div>
      )}

      {/* Content with padding */}
      <div className="w-full px-6 pb-6">
        <div className="w-full max-w-[1000px] mx-auto flex flex-col gap-6">
          {/* All Connections Section */}
          <div className="w-full">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 block">
              All Connections
            </span>
            {mcpStore.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No integrations available yet.</p>
              </div>
            ) : filteredMcpStore.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No integrations match your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMcpStore.map((item) => {
                  const connectedMcp = connectedMcpsByStoreId.get(item.id);

                  return (
                    <MCPCard
                      key={item.id}
                      mcpStoreItem={item}
                      connectedMcp={connectedMcp}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
