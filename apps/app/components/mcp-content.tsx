import { useSyncContext } from "../src/components/sync_engine";
import { useQuery } from "@rocicorp/zero/react";
import { getMCPStore, getMCPs } from "@jupiter/sync/queries/data";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { fuzzyMatch } from "@/src/lib/fuzzy-match";
import { MCPCard } from "@/components/mcp-card";

export function MCPContent() {
  const syncContext = useSyncContext();
  const mcpStore = useQuery(getMCPStore(syncContext.authData))[0];
  const userMcps = useQuery(getMCPs(syncContext.authData))[0];
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="flex flex-col justify-start items-start h-full w-full overflow-auto px-6 py-6">
      {/* MCP Store */}
      <div className="w-full max-w-[1200px] mx-auto flex flex-col items-center gap-6">
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
  );
}
