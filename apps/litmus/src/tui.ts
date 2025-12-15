import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { select, input, checkbox, confirm } from "@inquirer/prompts";
import { runAgentLoop } from "./core";
import {
  ServerConfigManager,
  OAuth2Client,
  CredentialStorage,
  type ServerConfig,
} from "./mcp/index.js";
import { connectMcpServer, type McpConnection } from "@august/harness";

const messages: MessageParam[] = [];
const serverConfigManager = new ServerConfigManager();
const credentialStorage = new CredentialStorage();

// Connected MCP servers (actual MCP connections with programmatic tool calling)
const connectedServers: Map<string, McpConnection> = new Map();

async function getAuthToken(server: ServerConfig): Promise<string | undefined> {
  const transport = server.transport;
  if (transport.type === "stdio" || !transport.requiresAuth) {
    return undefined;
  }

  const stored = await credentialStorage.loadCredentials(server.id);
  if (stored && (!stored.expiresAt || stored.expiresAt > Date.now())) {
    return stored.accessToken;
  }

  const oauth = new OAuth2Client(server.id);

  if (stored?.refreshToken) {
    try {
      const metadata = await oauth.discoverMetadata(transport.url);
      const refreshed = await oauth.refreshAccessToken(
        metadata.token_endpoint,
        stored.refreshToken,
        stored.clientId,
        stored.clientSecret
      );
      return refreshed.accessToken;
    } catch {
      console.log("Token refresh failed, starting new auth flow...");
    }
  }

  console.log(`\nAuthenticating with ${server.name}...`);
  const metadata = await oauth.discoverMetadata(transport.url);

  let clientId: string;
  let clientSecret: string | undefined;

  if (transport.clientId) {
    clientId = transport.clientId;
    clientSecret = transport.clientSecret;
  } else if (metadata.registration_endpoint) {
    const registration = await oauth.registerClient(
      metadata.registration_endpoint
    );
    clientId = registration.client_id as string;
    clientSecret = registration.client_secret as string | undefined;
  } else {
    throw new Error(
      "No client credentials and dynamic registration not supported"
    );
  }

  const credentials = await oauth.authorize(
    metadata.authorization_endpoint,
    metadata.token_endpoint,
    clientId,
    clientSecret
  );

  return credentials.accessToken;
}

async function autoConnectServers(): Promise<void> {
  const servers = serverConfigManager.getAllServers();
  const disconnected = servers.filter((s) => !connectedServers.has(s.id));

  for (const server of disconnected) {
    try {
      const transport = server.transport;
      if (transport.type === "stdio") {
        continue; // Skip stdio transports for now
      }

      // Get auth token if needed
      const authToken = await getAuthToken(server);

      // Connect via MCP client
      const connection = await connectMcpServer({
        name: server.name,
        url: transport.url,
        authToken,
      });

      connectedServers.set(server.id, connection);
      await serverConfigManager.markAsUsed(server.id);
      console.log(
        `\x1b[32m✓ Auto-connected to ${server.name} (${connection.tools.length} tools)\x1b[0m`
      );
    } catch (error) {
      console.error(
        `\x1b[31m✗ Failed to auto-connect to ${server.name}:\x1b[0m`,
        error instanceof Error ? error.message : error
      );
    }
  }
}

async function chat(): Promise<void> {
  console.log("\n\x1b[36m--- Chat Mode ---\x1b[0m");

  // Auto-connect to all configured servers
  await autoConnectServers();

  console.log("Type your message. Enter empty line to return to menu.\n");

  const connectedNames = Array.from(connectedServers.values()).map(
    (s) => s.name
  );
  if (connectedNames.length > 0) {
    console.log(
      `\x1b[90mConnected MCP servers: ${connectedNames.join(", ")}\x1b[0m\n`
    );
  }

  while (true) {
    const userInput = await input({ message: "\x1b[32mYou:\x1b[0m" });

    const trimmed = userInput.trim();
    if (!trimmed) {
      return;
    }

    messages.push({ role: "user", content: trimmed });
    process.stdout.write("\n\x1b[34mAssistant:\x1b[0m ");

    const mcpConnections = Array.from(connectedServers.values());

    try {
      await runAgentLoop({
        messages,
        mcpConnections,
        onText: (text) => process.stdout.write(text),
        onToolStart: (name, input) => {
          // Check if this is an MCP tool (prefixed with serverName__)
          const isMcpTool = name.includes("__");
          const color = isMcpTool ? "\x1b[35m" : "\x1b[33m";
          const label = isMcpTool ? "MCP Tool" : "Tool";
          console.log(`\n${color}[${label}: ${name}]\x1b[0m`);
          const inputStr = JSON.stringify(input, null, 2);
          console.log(
            `\x1b[90mInput: ${inputStr.slice(0, 500)}${inputStr.length > 500 ? "..." : ""}\x1b[0m`
          );
        },
        onToolResult: (name, result, isError) => {
          if (isError) {
            console.log(`\x1b[31mError: ${result}\x1b[0m`);
          } else {
            console.log(
              `\x1b[90mOutput: ${result.slice(0, 500)}${result.length > 500 ? "..." : ""}\x1b[0m`
            );
          }
        },
      });
      console.log("\n");
    } catch (error) {
      console.error("\n\x1b[31mError:\x1b[0m", error);
    }
  }
}

async function connectToServers(): Promise<void> {
  const servers = serverConfigManager.getAllServers();
  const disconnected = servers.filter((s) => !connectedServers.has(s.id));

  if (disconnected.length === 0) {
    console.log("\nNo servers to connect (all connected or none configured).");
    await waitForKey();
    return;
  }

  const serverIds = await checkbox({
    message: "Select servers to connect:",
    choices: disconnected.map((s) => ({
      name: s.name,
      value: s.id,
      checked: true,
    })),
  });

  for (const serverId of serverIds) {
    const server = serverConfigManager.getServer(serverId);
    if (!server) continue;

    try {
      console.log(`Connecting to ${server.name}...`);
      const transport = server.transport;
      if (transport.type === "stdio") {
        console.log("stdio transport not supported yet");
        continue;
      }

      // Get auth token if needed
      const authToken = await getAuthToken(server);

      // Connect via MCP client (with programmatic tool calling support)
      const connection = await connectMcpServer({
        name: server.name,
        url: transport.url,
        authToken,
      });

      connectedServers.set(server.id, connection);
      await serverConfigManager.markAsUsed(server.id);
      console.log(
        `\x1b[32m✓ Connected to ${server.name} (${connection.tools.length} tools)\x1b[0m`
      );
    } catch (error) {
      console.error(
        `\x1b[31m✗ Failed to connect to ${server.name}:\x1b[0m`,
        error
      );
    }
  }
  await waitForKey();
}

async function addServer(): Promise<void> {
  const name = await input({ message: "Server name:" });
  const url = await input({ message: "Server URL:" });
  const requiresAuth = await confirm({
    message: "Requires OAuth?",
    default: true,
  });

  const config = await serverConfigManager.addServer({
    name,
    transport: {
      type: "streamable-http",
      url,
      requiresAuth,
      authType: requiresAuth ? "oauth2" : undefined,
    },
  });
  console.log(`\x1b[32m✓ Added MCP server: ${config.name}\x1b[0m`);
  await waitForKey();
}

async function manageServers(): Promise<void> {
  while (true) {
    const servers = serverConfigManager.getAllServers();

    const action = await select({
      message: "Manage Servers:",
      choices: [
        { name: "📋 List servers", value: "list" },
        { name: "🔌 Disconnect from server", value: "disconnect" },
        { name: "🔑 Re-authenticate server", value: "auth" },
        { name: "🗑️  Remove server", value: "remove" },
        { name: "← Back", value: "back" },
      ],
    });

    if (action === "back") return;

    switch (action) {
      case "list":
        console.log("\n\x1b[36mConfigured MCP servers:\x1b[0m");
        if (servers.length === 0) {
          console.log("  (none)");
        } else {
          for (const server of servers) {
            const connected = connectedServers.has(server.id);
            const status = connected ? "\x1b[32m●\x1b[0m" : "\x1b[90m○\x1b[0m";
            const transport = server.transport;
            const url = "url" in transport ? transport.url : transport.command;
            console.log(`  ${status} ${server.name}`);
            console.log(`    \x1b[90m${url}\x1b[0m`);
          }
        }
        await waitForKey();
        break;

      case "disconnect":
        if (connectedServers.size === 0) {
          console.log("\nNo servers connected.");
          await waitForKey();
          break;
        }
        const connected = Array.from(connectedServers.entries());
        const disconnectIds = await checkbox({
          message: "Select servers to disconnect:",
          choices: connected.map(([id, conn]) => ({
            name: conn.name,
            value: id,
          })),
        });
        for (const id of disconnectIds) {
          const conn = connectedServers.get(id);
          if (conn) {
            try {
              await conn.disconnect();
            } catch {
              // Ignore disconnect errors
            }
            connectedServers.delete(id);
            console.log(`\x1b[32m✓ Disconnected from ${conn.name}\x1b[0m`);
          }
        }
        await waitForKey();
        break;

      case "auth":
        if (servers.length === 0) {
          console.log("\nNo servers configured.");
          await waitForKey();
          break;
        }
        const authServerId = await select({
          message: "Select server to re-authenticate:",
          choices: [
            ...servers.map((s) => ({ name: s.name, value: s.id })),
            { name: "← Back", value: "back" },
          ],
        });
        if (authServerId !== "back") {
          const server = serverConfigManager.getServer(authServerId);
          if (server) {
            // Disconnect existing connection if any
            const existingConn = connectedServers.get(server.id);
            if (existingConn) {
              try {
                await existingConn.disconnect();
              } catch {
                // Ignore
              }
              connectedServers.delete(server.id);
            }

            await credentialStorage.clearCredentials(server.id);
            console.log(`Re-authenticating ${server.name}...`);
            const transport = server.transport;
            if (transport.type !== "stdio" && "url" in transport) {
              try {
                const authToken = await getAuthToken(server);
                const connection = await connectMcpServer({
                  name: server.name,
                  url: transport.url,
                  authToken,
                });
                connectedServers.set(server.id, connection);
                console.log(
                  `\x1b[32m✓ Re-authenticated and connected to ${server.name} (${connection.tools.length} tools)\x1b[0m`
                );
              } catch (error) {
                console.error(`\x1b[31m✗ Failed:\x1b[0m`, error);
              }
            }
            await waitForKey();
          }
        }
        break;

      case "remove":
        if (servers.length === 0) {
          console.log("\nNo servers configured.");
          await waitForKey();
          break;
        }
        const removeServerId = await select({
          message: "Select server to remove:",
          choices: [
            ...servers.map((s) => ({ name: s.name, value: s.id })),
            { name: "← Back", value: "back" },
          ],
        });
        if (removeServerId !== "back") {
          const server = serverConfigManager.getServer(removeServerId);
          if (server) {
            connectedServers.delete(removeServerId);
            await serverConfigManager.removeServer(removeServerId);
            console.log(`\x1b[32m✓ Removed: ${server.name}\x1b[0m`);
            await waitForKey();
          }
        }
        break;
    }
  }
}

async function waitForKey(): Promise<void> {
  await input({ message: "\x1b[90mPress Enter to continue...\x1b[0m" });
}

async function main() {
  await serverConfigManager.load();

  while (true) {
    console.clear();
    console.log("╔═══════════════════════════════════════════╗");
    console.log("║           \x1b[36mLitmus Agent\x1b[0m                    ║");
    console.log("╚═══════════════════════════════════════════╝\n");

    const connectedCount = connectedServers.size;
    const serverCount = serverConfigManager.getAllServers().length;
    console.log(
      `\x1b[90mMCP Servers: ${connectedCount}/${serverCount} connected\x1b[0m\n`
    );

    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "💬 Chat", value: "chat" },
        { name: "🔌 Connect to servers", value: "connect" },
        { name: "➕ Add new server", value: "add" },
        { name: "⚙️  Manage servers", value: "manage" },
        { name: "🚪 Exit", value: "exit" },
      ],
    });

    switch (action) {
      case "chat":
        await chat();
        break;
      case "connect":
        await connectToServers();
        break;
      case "add":
        await addServer();
        break;
      case "manage":
        await manageServers();
        break;
      case "exit":
        console.log("Goodbye!");
        return;
    }
  }
}

main().catch(console.error);
