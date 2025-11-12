import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery } from "@rocicorp/zero/react";
import { getMCPs } from "@jupiter/sync/queries/data";
import { useSyncContext } from "@/src/components/sync_engine";
import { useAuth } from "@clerk/clerk-react";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamablehttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

type MCPConnection = {
  client: Client;
  tools: Tool[];
  connected: boolean;
};

type MCPRuntimeState = {
  connections: Map<string, MCPConnection>;
  toolsByMcpId: Map<string, Tool[]>;
  isInitialized: boolean;
  isLoading: boolean;
};

const MCPRuntimeContext = createContext<MCPRuntimeState>({
  connections: new Map(),
  toolsByMcpId: new Map(),
  isInitialized: false,
  isLoading: false,
});

export const MCPRuntimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const syncData = useSyncContext();
  const { getToken } = useAuth();
  const userMcps = useQuery(getMCPs(syncData.authData))[0];

  const [connections, setConnections] = useState<Map<string, MCPConnection>>(
    new Map()
  );
  const [toolsByMcpId, setToolsByMcpId] = useState<Map<string, Tool[]>>(
    new Map()
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use ref to track connections for cleanup
  const connectionsRef = useRef<Map<string, MCPConnection>>(new Map());

  useEffect(() => {
    let isMounted = true;

    const initializeMCPConnections = async () => {
      if (!userMcps || userMcps.length === 0) {
        setIsInitialized(true);
        return;
      }

      setIsLoading(true);

      const newConnections = new Map<string, MCPConnection>();
      const newToolsMap = new Map<string, Tool[]>();

      // Get auth token for MCP requests
      const token = await getToken({
        template: "cc-proxy",
        skipCache: true,
      });

      if (!token) {
        console.error("Failed to get auth token for MCP connections");
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // Connect to each MCP in parallel
      await Promise.all(
        userMcps.map(async (mcp) => {
          try {
            const mcpUrl = `${SERVER_URL}/proxy/mcp/${mcp.id}/`;

            // Create HTTPStreamable transport for MCP connection
            const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
              requestInit: {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            });

            // Create MCP client
            const client = new Client(
              {
                name: "august-mcp-client",
                version: "1.0.0",
              },
              {
                capabilities: {},
              }
            );

            // Connect to MCP server
            await client.connect(transport);

            // List available tools from this MCP
            const toolsResponse = await client.listTools();
            const tools = toolsResponse.tools;

            // Store connection and tools
            newConnections.set(mcp.id, {
              client,
              tools,
              connected: true,
            });

            newToolsMap.set(mcp.id, tools);

            console.log(`Connected to MCP: ${mcp.name} (${tools.length} tools)`);
          } catch (error) {
            console.error(`Failed to connect to MCP ${mcp.name}:`, error);
            // Store failed connection
            newConnections.set(mcp.id, {
              client: null as any,
              tools: [],
              connected: false,
            });
          }
        })
      );

      if (isMounted) {
        connectionsRef.current = newConnections;
        setConnections(newConnections);
        setToolsByMcpId(newToolsMap);
        setIsInitialized(true);
        setIsLoading(false);

        // Log MCP runtime information
        console.log("=== MCP Runtime Initialized ===");
        console.log(`Total MCPs connected: ${newConnections.size}`);

        newConnections.forEach((connection, mcpId) => {
          console.log(`\n--- MCP: ${mcpId} ---`);
          console.log(`Connected: ${connection.connected}`);
          console.log(`Tools count: ${connection.tools.length}`);

          if (connection.tools.length > 0) {
            console.log("Tools:");
            connection.tools.forEach((tool) => {
              console.log(
                `  - ${tool.name}${tool.description ? `: ${tool.description}` : ""}`
              );
            });
          }
        });

        console.log("\n=== Tools by MCP ID ===");
        newToolsMap.forEach((tools, mcpId) => {
          console.log(`${mcpId}: ${tools.length} tool(s)`);
        });
      } else {
        // Component unmounted during initialization, cleanup new connections
        newConnections.forEach((connection) => {
          if (connection.connected && connection.client) {
            connection.client.close().catch(console.error);
          }
        });
      }
    };

    initializeMCPConnections();

    // Cleanup: disconnect all clients on unmount or re-run
    return () => {
      isMounted = false;
      connectionsRef.current.forEach((connection) => {
        if (connection.connected && connection.client) {
          connection.client.close().catch(console.error);
        }
      });
      connectionsRef.current.clear();
    };
  }, [userMcps, getToken]);

  return (
    <MCPRuntimeContext.Provider
      value={{
        connections,
        toolsByMcpId,
        isInitialized,
        isLoading,
      }}
    >
      {children}
    </MCPRuntimeContext.Provider>
  );
};

export const useMCPRuntime = () => {
  const context = useContext(MCPRuntimeContext);
  if (context === undefined) {
    throw new Error("useMCPRuntime must be used within a MCPRuntimeProvider");
  }
  return context;
};

/**
 * Hook to get a map of MCP ID to available tools
 */
export const useMCPTools = (): Map<string, Tool[]> => {
  const context = useContext(MCPRuntimeContext);
  if (context === undefined) {
    throw new Error("useMCPTools must be used within a MCPRuntimeProvider");
  }
  return context.toolsByMcpId;
};

/**
 * Hook to get tools for a specific MCP
 */
export const useMCPToolsById = (mcpId: string): Tool[] => {
  const context = useContext(MCPRuntimeContext);
  if (context === undefined) {
    throw new Error("useMCPToolsById must be used within a MCPRuntimeProvider");
  }
  return context.toolsByMcpId.get(mcpId) || [];
};
