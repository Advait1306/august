import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { select, input, checkbox, confirm } from "@inquirer/prompts";
import { runAgentLoop, type MCPServerDefinition } from "./core.js";
import { ServerConfigManager, OAuth2Client, CredentialStorage, type ServerConfig } from "./mcp/index.js";

const messages: MessageParam[] = [];
const serverConfigManager = new ServerConfigManager();
const credentialStorage = new CredentialStorage();

// Connected MCP servers with their auth tokens
const connectedServers: Map<string, MCPServerDefinition> = new Map();

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
    const registration = await oauth.registerClient(metadata.registration_endpoint);
    clientId = registration.client_id as string;
    clientSecret = registration.client_secret as string | undefined;
  } else {
    throw new Error("No client credentials and dynamic registration not supported");
  }

  const credentials = await oauth.authorize(
    metadata.authorization_endpoint,
    metadata.token_endpoint,
    clientId,
    clientSecret
  );

  return credentials.accessToken;
}

async function chat(): Promise<void> {
  console.log("\n\x1b[36m--- Chat Mode ---\x1b[0m");
  console.log("Type your message. Enter empty line to return to menu.\n");

  const connectedNames = Array.from(connectedServers.values()).map(s => s.name);
  if (connectedNames.length > 0) {
    console.log(`\x1b[90mConnected MCP servers: ${connectedNames.join(", ")}\x1b[0m\n`);
  }

  while (true) {
    const userInput = await input({ message: "\x1b[32mYou:\x1b[0m" });

    const trimmed = userInput.trim();
    if (!trimmed) {
      return;
    }

    messages.push({ role: "user", content: trimmed });
    process.stdout.write("\n\x1b[34mAssistant:\x1b[0m ");

    const mcpServers = Array.from(connectedServers.values());

    try {
      await runAgentLoop({
        messages,
        mcpServers,
        onText: (text) => process.stdout.write(text),
        onToolStart: (name, input) => {
          console.log(`\n\x1b[33m[Tool: ${name}]\x1b[0m`);
          const inputStr = JSON.stringify(input, null, 2);
          console.log(`\x1b[90mInput: ${inputStr.slice(0, 500)}${inputStr.length > 500 ? "..." : ""}\x1b[0m`);
        },
        onToolResult: (name, result, isError) => {
          if (isError) {
            console.log(`\x1b[31mError: ${result}\x1b[0m`);
          } else {
            console.log(`\x1b[90mOutput: ${result.slice(0, 500)}${result.length > 500 ? "..." : ""}\x1b[0m`);
          }
        },
        onMcpToolUse: (name, serverName, input) => {
          console.log(`\n\x1b[35m[MCP Tool: ${name} @ ${serverName}]\x1b[0m`);
          const inputStr = JSON.stringify(input, null, 2);
          console.log(`\x1b[90mInput: ${inputStr.slice(0, 500)}${inputStr.length > 500 ? "..." : ""}\x1b[0m`);
        },
        onMcpToolResult: (_toolUseId, content, isError) => {
          const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2);
          if (isError) {
            console.log(`\x1b[31mMCP Error: ${contentStr.slice(0, 500)}${contentStr.length > 500 ? "..." : ""}\x1b[0m`);
          } else {
            console.log(`\x1b[90mMCP Output: ${contentStr.slice(0, 500)}${contentStr.length > 500 ? "..." : ""}\x1b[0m`);
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
  const disconnected = servers.filter(s => !connectedServers.has(s.id));

  if (disconnected.length === 0) {
    console.log("\nNo servers to connect (all connected or none configured).");
    await waitForKey();
    return;
  }

  const serverIds = await checkbox({
    message: "Select servers to connect:",
    choices: disconnected.map(s => ({ name: s.name, value: s.id, checked: true })),
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

      const authToken = await getAuthToken(server);
      connectedServers.set(server.id, {
        name: server.name,
        url: transport.url,
        authToken,
      });
      await serverConfigManager.markAsUsed(server.id);
      console.log(`\x1b[32m✓ Connected to ${server.name}\x1b[0m`);
    } catch (error) {
      console.error(`\x1b[31m✗ Failed to connect to ${server.name}:\x1b[0m`, error);
    }
  }
  await waitForKey();
}

async function addServer(): Promise<void> {
  const name = await input({ message: "Server name:" });
  const url = await input({ message: "Server URL:" });
  const requiresAuth = await confirm({ message: "Requires OAuth?", default: true });

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
          choices: connected.map(([id, def]) => ({ name: def.name, value: id })),
        });
        for (const id of disconnectIds) {
          const def = connectedServers.get(id);
          connectedServers.delete(id);
          console.log(`\x1b[32m✓ Disconnected from ${def?.name}\x1b[0m`);
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
            ...servers.map(s => ({ name: s.name, value: s.id })),
            { name: "← Back", value: "back" },
          ],
        });
        if (authServerId !== "back") {
          const server = serverConfigManager.getServer(authServerId);
          if (server) {
            await credentialStorage.clearCredentials(server.id);
            connectedServers.delete(server.id);
            console.log(`Re-authenticating ${server.name}...`);
            const transport = server.transport;
            if (transport.type !== "stdio" && "url" in transport) {
              try {
                const authToken = await getAuthToken(server);
                connectedServers.set(server.id, {
                  name: server.name,
                  url: transport.url,
                  authToken,
                });
                console.log(`\x1b[32m✓ Re-authenticated and connected to ${server.name}\x1b[0m`);
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
            ...servers.map(s => ({ name: s.name, value: s.id })),
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
    console.log(`\x1b[90mMCP Servers: ${connectedCount}/${serverCount} connected\x1b[0m\n`);

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
