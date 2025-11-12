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
}

function MCPCard({ item }: MCPCardProps) {
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
            variant="secondary"
            size="sm"
            className="rounded-full text-[12px] !py-3 h-[28px]"
          >
            Connect
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
}

function ConnectedMCPCard({ item }: ConnectedMCPCardProps) {
  // Only extract colors if we have a logo
  const { darkerColor, lighterColor } = useImageColor(item.logo_url || "");

  // Use default colors for custom MCPs without logos
  const bgColor = item.logo_url ? darkerColor : "#e0e0e0";
  const borderColor = item.logo_url ? lighterColor : "#d0d0d0";

  return (
    <div
      className="w-[72px] h-[72px] flex items-center justify-center relative border-1 rounded-xl bg-card hover:shadow-md transition-all overflow-hidden"
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

function MCP() {
  const syncContext = useSyncContext();
  const mcpStore = useQuery(getMCPStore(syncContext.authData))[0];
  const userMcps = useQuery(getMCPs(syncContext.authData))[0];
  const [searchQuery, setSearchQuery] = useState("");

  // Filter mcpStore based on search query
  const filteredMcpStore = useMemo(() => {
    if (!searchQuery) return mcpStore;
    return mcpStore.filter((item) => fuzzyMatch(item.name, searchQuery));
  }, [mcpStore, searchQuery]);

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
                return <MCPCard key={item.id} item={item} />;
              })}
            </div>
          )}
        </div>
      </div>
    </ShellOnly>
  );
}
