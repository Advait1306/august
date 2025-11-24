# Jupiter Public API & Component Reference

This guide enumerates every exported API surface in the Jupiter monorepo—from low-level IPC channels up through the Electron shell, backend services, sync layer, and front-end components. Each section explains intent, key contracts, and shows practical usage snippets so you can reuse the same primitives when extending the platform.

---

## 1. Shared IPC & Type System (`packages/shared`)

### 1.1 Channel Directory

All IPC traffic is routed through the strongly typed `IPC_CHANNELS` map, preventing magic strings and keeping preload, renderer, and main in sync.

```1:26:packages/shared/src/ipc/channels.ts
export const IPC_CHANNELS = {
  AGENT: {
    RUN: 'agent:run',
    PERMISSION_REQUEST: 'permission:request',
    PERMISSION_RESPONSE: 'permission:response',
  },
  PROJECTS: {
    SELECT_FOLDER: 'projects:selectFolder',
    GET_DEFAULT_CWD: 'projects:getDefaultCwd',
  },
  AUTH: {
    OPEN_LOGIN: 'auth:open-login',
    TICKET_RECEIVED: 'auth:ticket-received',
  },
  AUTO_UPDATER: {
    CHECK: 'auto-updater:check-for-updates',
    QUIT_AND_INSTALL: 'auto-updater:quit-and-install',
    GET_INFO: 'auto-updater:get-update-info',
  },
  CLAUDE_CODE: {
    DISCOVER_INSTALLATIONS: 'claude-code:discoverInstallations',
  },
  BROWSER: {
    OPEN_URL: 'browser:open-url',
  },
} as const;
```

### 1.2 Contracts & Agent Interfaces

`IPC.Agent`, `IPC.Folder`, `IPC.Auth`, etc. describe per-channel payloads. These types are imported both by the shell and the renderer so TypeScript will flag any mismatch.

```4:65:packages/shared/src/ipc/contracts.ts
export namespace IPC {
  export namespace Agent {
    export interface RunOptions {
      messages: ModelMessage[];
      runConfig: Record<string, unknown>;
      threadId: string;
    }
    export interface RunRequest {
      options: RunOptions;
      systemPrompt?: string;
      path?: string;
      env?: Record<string, string>;
      mcpServers?: Record<
        string,
        {
          type: "http";
          url: string;
          headers: Record<string, string>;
        }
      >;
      settingSources?: string[];
    }
    export interface RunParams extends RunRequest {
      id: string;
    }
  }
  export namespace Folder {
    export type SelectFolderResponse = {
      name: string;
      path: string;
    } | null;
    export type GetDefaultCwdResponse = string;
  }
  export namespace Auth {
    export type OpenLoginResponse = boolean;
    export type TicketReceivedEvent = string;
  }
  export namespace AutoUpdater {
    export interface OperationResponse {
      success: boolean;
      error?: string;
    }
    export interface UpdateInfoResponse {
      success: boolean;
      data?: any;
      error?: string;
    }
  }
  export namespace ClaudeCode {
    export type DiscoverInstallationsResponse = ClaudeInstallation[];
  }
}
```

### 1.3 Window Bridge

The shared window typing ensures `window.api` is identical in both Vite (renderer) and Electron contexts.

```1:35:packages/shared/src/types/window.ts
declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      projects: {
        selectFolder: () => Promise<{ name: string; path: string } | null>;
        getDefaultCwd: () => Promise<string>;
      };
      auth: {
        getToken?: () => Promise<string | null>;
        openLogin: () => Promise<boolean>;
        onTokenReceived: (callback: (token: string) => void) => () => void;
      };
      autoUpdater: {
        checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
        quitAndInstall: () => Promise<{ success: boolean; error?: string }>;
        getUpdateInfo: () => Promise<{
          success: boolean;
          data?: any;
          error?: string;
        }>;
      };
      agent: AgentTypes;
      claudeCode: {
        discoverInstallations: () => Promise<ClaudeInstallation[]>;
      };
      browser: {
        openUrl: (url: string) => Promise<boolean>;
      };
    };
  }
}
```

### 1.4 Permission & Streaming Utilities

`agentRequestPermissionOverIPC` pushes permission prompts to the renderer and waits on a dynamically scoped reply channel, while the async generator helpers stream responses safely across IPC boundaries.

```3:29:packages/shared/src/utils/agent-request-permission-over-ipc.ts
export async function agentRequestPermissionOverIPC(
  event: Electron.IpcMainInvokeEvent,
  request: {
    toolName: string;
    input: Record<string, any>;
    threadId: string;
  }
): Promise<boolean> {
  const p = new Promise<boolean>((resolve) => {
    const requestId = crypto.randomUUID();
    try {
      event.sender.send(`permission:request`, {
        ...request,
        id: requestId,
      });
    } catch (error) {
      console.error("agentRequestPermissionOverIPC", error);
      resolve(false);
    }
    ipcMain.handle(`permission:response-${requestId}`, (_, response) => {
      resolve(response);
    });
  });
  return p;
}
```

```4:99:packages/shared/src/utils/async-generator-over-ipc-consumer.tsx
export function asyncGeneratorOverIPCConsumer<T>(f: (id: string) => void) {
  const id = randomUUID();
  const queue: Array<{ value: T; done: boolean }> = [];
  let done = false;
  let error: Error | null = null;
  let pendingResolve: ((v: IteratorResult<any>) => void) | null = null;
  let pendingReject: ((e: any) => void) | null = null;
  const onChunk = (_: any, msg: T) => {
    const item = { value: msg, done: false as const };
    if (pendingResolve) {
      const r = pendingResolve;
      pendingResolve = null;
      pendingReject = null;
      r(item);
    } else {
      queue.push(item);
    }
  };
  const onDone = () => {
    done = true;
    if (pendingResolve) {
      const r = pendingResolve;
      pendingResolve = null;
      pendingReject = null;
      r({ value: undefined, done: true });
    }
    cleanup();
  };
  function cleanup() {
    ipcRenderer.removeListener(`stream:chunk-${id}`, onChunk);
    ipcRenderer.removeListener(`stream:done-${id}`, onDone);
    ipcRenderer.removeListener(`stream:error-${id}`, onError);
  }
  function cancel() {
    if (!cancelled && !done) {
      cancelled = true;
      ipcRenderer.send(`stream:cancel-${id}`);
      cleanup();
    }
  }
  ipcRenderer.on(`stream:chunk-${id}`, onChunk);
  ipcRenderer.on(`stream:done-${id}`, onDone);
  ipcRenderer.on(`stream:error-${id}`, onError);
  f(id);
  const iterator: AsyncIterator<any> = {
    next() { /* ... */ },
    return() { cancel(); return Promise.resolve({ value: undefined, done: true }); },
    throw(err) { cancel(); return Promise.reject(err); },
  };
  return {
    [Symbol.asyncIterator]() {
      return iterator;
    },
    cancel,
  };
}
```

### 1.5 Example: Streaming an Agent from the Renderer

```ts
import { useEffect } from "react";

async function runTask(prompt: string) {
  const iterator = window.api.agent.run({
    options: {
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      runConfig: { cwd: "/Users/me/project" },
      threadId: crypto.randomUUID(),
    },
    systemPrompt: "You are a helpful coding assistant",
    path: "/Applications/Claude/claude",
  });

  try {
    for await (const chunk of iterator) {
      console.log(chunk.content);
    }
  } finally {
    iterator.cancel();
  }
}
```

---

## 2. Electron Shell APIs (`apps/shell`)

### 2.1 Preload Contract

The preload exposes every shared API hook via `contextBridge`, so `window.api` is identical inside the Vite UI and in the Electron renderer.

```1:33:apps/shell/src/preload/index.ts
const api = {
  projects: {
    selectFolder: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.SELECT_FOLDER),
    getDefaultCwd: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.GET_DEFAULT_CWD)
  },
  auth: {
    openLogin: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AUTH.OPEN_LOGIN),
    onTokenReceived: (callback: (ticket: string) => void) => {
      electronAPI.ipcRenderer.on(IPC_CHANNELS.AUTH.TICKET_RECEIVED, (_, ticket) => callback(ticket))
      return () => electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.AUTH.TICKET_RECEIVED)
    }
  },
  autoUpdater: {
    checkForUpdates: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AUTO_UPDATER.CHECK),
    quitAndInstall: () =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AUTO_UPDATER.QUIT_AND_INSTALL),
    getUpdateInfo: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AUTO_UPDATER.GET_INFO)
  },
  agent: agent,
  claudeCode: {
    discoverInstallations: () =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_CODE.DISCOVER_INSTALLATIONS)
  },
  browser: {
    openUrl: (url: string) => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.BROWSER.OPEN_URL, url)
  }
};
```

### 2.2 Main-Process IPC Handlers

Each handler resides in `apps/shell/src/main/ipc/*` and exactly mirrors the shared channels:

- `projects`: folder picker and default working directory management.
- `auth`: opens the hosted Clerk login and forwards deep-link tickets.
- `auto-updater`: wraps `electron-updater`.
- `browser`: opens URLs in the system browser.
- `agents`: proxies Claude Code installation discovery.

```7:53:apps/shell/src/main/ipc/projects.ts
ipcMain.handle(
  IPC_CHANNELS.PROJECTS.SELECT_FOLDER,
  async (): Promise<IPC.Folder.SelectFolderResponse> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Select Project Folder' })
    if (result.canceled || !result.filePaths.length) {
      return null
    }
    const folderPath = result.filePaths[0]
    const folderName = basename(folderPath) || 'Unnamed Project'
    return { name: folderName, path: folderPath }
  }
)
ipcMain.handle(
  IPC_CHANNELS.PROJECTS.GET_DEFAULT_CWD,
  async (): Promise<IPC.Folder.GetDefaultCwdResponse> => {
    const home = homedir()
    const defaultPath = join(home, 'Documents', 'August')
    if (!existsSync(defaultPath)) {
      mkdirSync(defaultPath, { recursive: true })
    }
    return defaultPath
  }
)
```

```10:23:apps/shell/src/main/ipc/auth.ts
export function registerAuthIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH.OPEN_LOGIN, async (): Promise<IPC.Auth.OpenLoginResponse> => {
    const { shell } = await import('electron')
    shell.openExternal('https://app.august.tech/authorise')
    return true
  })
}
export function handleAuthToken(token: IPC.Auth.TicketReceivedEvent): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.AUTH.TICKET_RECEIVED, token)
  }
}
```

```5:52:apps/shell/src/main/ipc/auto-updater.ts
ipcMain.handle(
  IPC_CHANNELS.AUTO_UPDATER.CHECK,
  async (): Promise<IPC.AutoUpdater.OperationResponse> => {
    await autoUpdaterService.checkForUpdates()
    return { success: true }
  }
)
ipcMain.handle(
  IPC_CHANNELS.AUTO_UPDATER.QUIT_AND_INSTALL,
  async (): Promise<IPC.AutoUpdater.OperationResponse> => {
    await autoUpdaterService.quitAndInstall()
    return { success: true }
  }
)
ipcMain.handle(
  IPC_CHANNELS.AUTO_UPDATER.GET_INFO,
  async (): Promise<IPC.AutoUpdater.UpdateInfoResponse> => {
    const updateInfo = await autoUpdaterService.getUpdateInfo()
    return { success: true, data: updateInfo }
  }
)
```

### 2.3 Agent Runtime

`AgentAdapterMain` registers the base agents, streams their output through the async generator helpers, and forwards permission prompts.

```14:76:apps/shell/src/main/agent/agent-adapter-main.ts
ipcMain.handle(
  IPC_CHANNELS.AGENT.RUN,
  async (event: IpcMainInvokeEvent, params: IPC.Agent.RunParams) => {
    await this.runAgent(event, params)
  }
)
public async runAgent(event: IpcMainInvokeEvent, params: IPC.Agent.RunParams): Promise<void> {
  const abortController = new AbortController()
  const cleanupCancelListener = asyncGeneratorOverIPCCancelListener(event, params.id, () => {
    abortController.abort()
  })
  try {
    for await (const message of this.agents['claude-code'].run(
      params,
      (request) => {
        return agentRequestPermissionOverIPC(event, request)
      },
      abortController.signal
    )) {
      if (abortController.signal.aborted) {
        break
      }
      asyncGeneratorOverIPCSender(event, params.id, message)
    }
    asyncGeneratorOverIPCCloser(event, params.id)
  } finally {
    cleanupCancelListener()
  }
}
```

### 2.4 Auto-Updater Service

`AutoUpdaterService` encapsulates `electron-updater`, relays status events to the renderer, and keeps polling every four hours.

```23:90:apps/shell/src/main/services/auto-updater-service.ts
export class AutoUpdaterService {
  private constructor() {
    this.setupAutoUpdater()
  }
  private setupAutoUpdater(): void {
    autoUpdater.logger = log
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates()
    }, 4 * 60 * 60 * 1000)
    autoUpdater.on('checking-for-update', () => this.sendToRenderer('update-checking'))
    autoUpdater.on('update-available', (info) => this.sendToRenderer('update-available', info))
    autoUpdater.on('update-not-available', (info) => this.sendToRenderer('update-not-available', info))
    autoUpdater.on('error', (err) => this.sendToRenderer('update-error', { message: err.message }))
    autoUpdater.on('download-progress', (progress) => this.sendToRenderer('update-download-progress', progress))
    autoUpdater.on('update-downloaded', (event) => this.sendToRenderer('update-downloaded', event))
  }
}
```

### 2.5 Example: Cancelable Runs from the UI

```ts
const iterator = window.api.agent.run({
  options: {
    messages,
    runConfig: { cwd },
    threadId: taskId,
  },
  systemPrompt: agent?.system_prompt,
  path: claudeInstallation.path,
});
activeIterators.current[taskId] = iterator;
try {
  for await (const reply of iterator) {
    z.mutate.message.update({ task_id: taskId, /* ... */ content: reply.content });
  }
} finally {
  delete activeIterators.current[taskId];
}
```

---

## 3. Server HTTP APIs (`apps/server`)

### 3.1 Controllers & Routes

| Controller | Route | Method | Description |
|------------|-------|--------|-------------|
| Clerk | `/clerk` | POST | Verifies Clerk webhooks for user/org lifecycle |
| Clerk | `/ticket` | GET | Exchanges authenticated session for a sign-in ticket |
| Billing | `/api/webhooks/dodo` | POST | Validates DodoPayments webhook and credits wallets |
| Billing | `/api/checkout/create` | POST | Returns DodoPayments checkout URL for wallet top-ups |
| Sync | `/get-queries` | POST | Proxy to Zero read model using Clerk auth |
| Sync | `/push` | POST | Proxy to Zero write model (mutators) |
| Proxy | `/cc-proxy/v1/messages` | POST | Streams Anthropic messages after wallet gating |
| Proxy | `/proxy/mcp/:mcpId/*` | ALL | Proxies HTTP to OAuth or Composio MCP servers |
| MCP | `/api/mcp/authorize` | POST | Starts OAuth/Composio flows for MCP store entries |
| MCP | `/api/mcp/callback` | GET | Completes OAuth/Composio flows and creates MCP records |
| Redirect | `/redirect/composio` | ANY | Forwards query params to Composio callback |

Examples:

```29:197:apps/server/src/controllers/billing.controller.ts
router.post("/api/webhooks/dodo", async (req, res) => {
  const webhook = new Webhook(process.env.DODO_WEBHOOK_SECRET!);
  const event = webhook.verify(req.body.toString(), headers);
  if (event.type === "payment.succeeded") {
    const organisationId = event.data.metadata?.organisation_id;
    const amountUsdCents = event.data.metadata?.amount_usd_cents;
    const result = await billingService.addCredits(organisationId, parseInt(amountUsdCents));
    return res.status(200).json({ success: true, message: "Credits added successfully" });
  }
  return res.status(200).json({ success: true });
});
router.post("/api/checkout/create", async (req, res) => {
  const { amount, returnUrl } = req.body;
  const checkoutSessionResponse = await dodoClient.checkoutSessions.create({
    product_cart: [{ product_id: PRODUCT_ID, quantity: 1, amount }],
    customer: { name: user?.fullName ?? "", email: user?.primaryEmailAddress?.emailAddress ?? "" },
    metadata: { organisation_id: organisationId, amount_usd_cents: amount.toString() },
    return_url: returnUrl,
  });
  return res.json({ success: true, checkoutUrl: checkoutSessionResponse.checkout_url });
});
```

```24:225:apps/server/src/controllers/proxy.controller.ts
router.post("/cc-proxy/v1/messages", async (req, res) => {
  await proxyService.forwardToAnthropic(req.body, req.headers["anthropic-version"] as string, res, organisationId);
});
router.all("/proxy/mcp/:mcpId/{*path}", async (req, res) => {
  const mcp = await db.select().from(mcps).where(/* author + org */).limit(1);
  if (mcp.integration_type === "composio") {
    const connectionUrl = await composioService.getConnectionUrl({ mcpId });
    await proxyService.forwardToComposioMCP(connectionUrl, req, res, path);
    return;
  }
  const accessToken = await oauthService.getAccessToken({ mcpId });
  await proxyService.forwardToMCP(mcpServerUrl, accessToken, req, res, path);
});
```

```20:167:apps/server/src/controllers/mcp.controller.ts
router.post("/api/mcp/authorize", async (req, res) => {
  const { mcp_store_id, custom_mcp_url, custom_mcp_name } = req.body;
  if (store.integration_type === "composio") {
    const result = await composioService.initiateComposioFlow({ mcpStoreId: mcp_store_id!, userId, organisationId });
    res.json({ authorizationUrl: result.redirectUrl });
    return;
  }
  const result = await oauthService.initiateOAuthFlow({ mcpStoreId: mcp_store_id, customMcpUrl: custom_mcp_url, customMcpName: custom_mcp_name, userId, organisationId });
  res.json({ authorizationUrl: result.authorizationUrl });
});
router.get("/api/mcp/callback", async (req, res) => {
  if (connected_account_id) {
    const result = await composioService.handleComposioCallback({ connectedAccountId: connected_account_id });
    return res.redirect(result.redirectUri ?? `${process.env.WEB_URL}/integrations?status=${result.success ? "success" : "error"}`);
  }
  const result = await oauthService.handleOAuthCallback({ code, state });
  res.redirect(result.redirectUri ?? `${process.env.WEB_URL}/integrations?status=${result.success ? "success" : "error"}`);
});
```

Other controllers follow the same pattern (`createClerkController`, `createSyncController`, `createRedirectController`) and live under `apps/server/src/controllers`.

### 3.2 Services & Middleware

- `ClerkService` creates/tears down `users` and `organisations`, and issues Clerk sign-in tokens.
- `BillingService` holds wallet math, cost calculation, and ledger insertion.[^billing-service]
- `OAuthService` implements OAuth discovery, client registration, token exchange, refresh and revocation for MCPs.[^oauth-service]
- `ComposioService` orchestrates Composio link flows and persists generated MCP instances.[^composio-service]
- `ProxyService` forwards HTTP requests to Anthropic/MCP servers while updating usage/costs.[^proxy-service]
- `SyncService` wraps the Zero processor for `/get-queries` and `/push`.
- `apiKeyToAuthMiddleware` maps `x-api-key` headers to `authorization` for the cc-proxy route.

[^billing-service]:
```5:178:apps/server/src/services/billing.service.ts
async deductUsage(orgId: string, model: string, usageData: UsageData) {
  const costInCents = this.calculateClaudeCost(model, usageData);
  await this.db.insert(usage).values({ organisation_id: orgId, model, input_tokens: usageData.input_tokens || 0, /* ... */ });
  await this.db.update(organisations).set({ wallet: sql`${organisations.wallet} - ${costInCents}` }).where(eq(organisations.id, orgId));
}
```

[^oauth-service]:
```91:463:apps/server/src/services/oauth.service.ts
const metadata = await this.discoverOAuthMetadata(mcpServerUrl);
const registrationResponse = await fetch(metadata.registration_endpoint, { method: "POST", body: JSON.stringify(registrationPayload) });
await this.db.insert(oauthStates).values({ state, oauth_metadata: stateData, code_verifier: codeVerifier });
const tokenResponse = await fetch(storedMetadata.token_endpoint, { method: "POST", body: new URLSearchParams(tokenParams) });
await this.db.insert(mcps).values({ id: newMcpId, organisation_id: stateRecord.organisation_id, /* ... */ });
await this.db.insert(mcpOauthConnections).values({ mcp_id: newMcpId, access_token: encrypt(tokenData.access_token), refresh_token: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null });
```

[^composio-service]:
```28:265:apps/server/src/services/composio.service.ts
const connectionRequest = await this.composio.connectedAccounts.link(composioUserId, composioDetails.auth_config_id, { callbackUrl: `${process.env.SERVER_URL}/api/mcp/callback` });
await this.db.insert(composioStates).values({ connection_request_id: connectionRequest.id, user_id: userId, organisation_id: organisationId });
const instance = await this.composio.mcp.generate(composioUserId, composioDetails.mcp_config_id);
await this.db.insert(mcps).values({ id: newMcpId, organisation_id: organisationId, author_id: userId, name: store.name, integration_type: "composio" });
await this.db.insert(mcpComposioConnections).values({ mcp_id: newMcpId, connection_url: instance.url });
```

[^proxy-service]:
```14:152:apps/server/src/services/proxy.service.ts
const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": anthropicVersion }, body: JSON.stringify(body) });
if (response.body) {
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(decoder.decode(value, { stream: true }));
  }
  res.end();
  await this.parseAndDeductUsage(streamedData, orgId);
}
```

---

## 4. Sync Package (`packages/sync`)

### 4.1 Drizzle Schema

The schema models orgs, agents, tasks, usage, MCP store, OAuth/Composio states, and more.

```82:200:packages/sync/src/db/schema.ts
export const mcps = pgTable("mcps", {
  id: varchar().primaryKey().notNull(),
  organisation_id: varchar().notNull().references(() => organisations.id),
  author_id: varchar().notNull().references(() => users.id),
  name: varchar().notNull(),
  mcp_store_id: varchar().references(() => mcpStore.id),
  integration_type: integrationType().notNull(),
  custom_mcp_server_url: varchar(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});
export const oauthStates = pgTable("oauth_states", {
  id: varchar().primaryKey().notNull(),
  state: varchar().unique().notNull(),
  user_id: varchar().notNull().references(() => users.id),
  organisation_id: varchar().notNull().references(() => organisations.id),
  mcp_store_id: varchar().references(() => mcpStore.id),
  custom_mcp_url: varchar(),
  custom_mcp_name: varchar(),
  oauth_metadata: jsonb(),
  redirect_uri: varchar().notNull(),
  code_verifier: varchar(),
  created_at: timestamp().notNull().defaultNow(),
  expires_at: timestamp().notNull(),
});
```

### 4.2 Queries, Mutators & Analytics

- `queries/data.ts` wraps `@rocicorp/zero` query builders for tasks, messages, usage, orgs, MCP store, etc.
- `mutators/data.ts` defines client-side CRUD (agents/tasks/messages/mcps) scoped to authenticated user/org IDs.
- `server-mutators/data.ts` wraps client mutators with Mixpanel tracking and adds privileged logic (e.g., OAuth token revocation).

```9:170:packages/sync/src/mutators/data.ts
export function createMutators(authData: AuthData) {
  return {
    agents: {
      create: async (tx, { agent_id, name, system_prompt, base_agent }) => {
        await tx.mutate.agents.insert({
          id: agent_id,
          name,
          system_prompt,
          base_agent,
          author_id: authData.userId,
          organisation_id: authData.orgId,
        });
      },
      update: async (tx, { agent_id, name, system_prompt }) => {
        await tx.mutate.agents.update({ id: agent_id, name, system_prompt });
      },
      delete: async (tx, { agent_id }) => {
        await tx.mutate.agents.delete({ id: agent_id });
      },
    },
    tasks: {
      create: async (tx, { task_id, agent_id, message_data }) => {
        const name = message_data.content.find((part) => part.type === "text")?.text ?? "New Task";
        await tx.mutate.tasks.insert({ id: task_id, author_id: authData.userId, name, ...(agent_id && { agent_id }), organisation_id: authData.orgId, created_at: Date.now() });
        await tx.mutate.messages.upsert({ id: message_data.message_id, task_id, message_id: message_data.message_id, role: message_data.role, content: message_data.content, metadata: message_data.metadata, created_at: Date.now() });
      },
    },
    message: {
      create: async (tx, { task_id, message_id, role, content, metadata }) => {
        await tx.mutate.messages.insert({ id: message_id, task_id, message_id, role, content, metadata, created_at: Date.now() });
      },
    },
    mcps: {
      delete: async (tx, { mcp_id }) => {
        await tx.mutate.mcps.delete({ id: mcp_id });
      },
    },
  } as const;
}
```

```18:246:packages/sync/src/server-mutators/data.ts
const analyticsConfig = {
  projects: { create: { event: "project_created" }, update: { event: "project_updated" }, delete: { event: "project_deleted" } },
  agents: { create: { event: "agent_created" }, update: { event: "agent_updated" }, delete: { event: "agent_deleted" } },
  tasks: { create: { event: "task_created" } },
  message: { create: { event: "message_created" }, update: { event: "message_updated" } },
};
const trackEvent = async (event: string, properties: Record<string, any>) => {
  asyncTasks.push(async () => {
    mixpanel.track(event, { $user_id: authData.userId, org_id: authData.orgId, ...properties });
  });
};
return {
  ...wrappedMutators,
  mcps: {
    delete: async (tx, { mcp_id }) => {
      const mcp = await tx.query.mcps.where("id", mcp_id).where("author_id", authData.userId).one().run();
      if (mcp.integration_type === "oauth") {
        await oauthService.revokeToken({ mcpId: mcp_id });
      } else {
        const composioConnection = await tx.query.mcpComposioConnections.where("mcp_id", mcp_id).one().run();
        await tx.mutate.mcpComposioConnections.delete({ id: composioConnection.id });
      }
      await tx.mutate.mcps.delete({ id: mcp_id });
    },
  },
};
```

---

## 5. Front-End Application APIs (`apps/app`)

### 5.1 Context Providers

- **`SettingsProvider`** stores appearance, Claude Code, privacy, and experimental toggles in `localStorage`. Hooks `useSettings`, `useSettingsSection`, and `useNestedSetting` simplify access.[^settings-context]
- **`SyncEngine`** hydrates Zero using Clerk auth, exposes `authData`, and only renders children once the user is signed in.
- **`TaskRuntimeProvider`** centralizes task selection, sends messages via MCP-aware agents, tracks permissions and streaming iterators, and surfaces composer state/hotkey menus.[^task-runtime]
- **`UpdateProvider`** listens for auto-updater renderer events and exposes `useUpdate` / `useUpdateStatus` for UI prompts.[^update-context]
- **`ThemeProvider`** syncs user preference or system theme into the DOM class list, with automatic changes on OS theme updates.

[^settings-context]:
```140:204:apps/app/src/contexts/settings-context.tsx
export function SettingsProvider({ children, defaultSettings = {}, storageKey = "august-settings" }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(() => { /* hydrate from localStorage */ });
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings, storageKey]);
  const updateSetting = useCallback((key, value) => setSettings((prev) => ({ ...prev, [key]: value })), []);
  return (
    <SettingsProviderContext.Provider value={{ settings, updateSetting, updateSettings, resetSettings }}>
      {children}
    </SettingsProviderContext.Provider>
  );
}
```

[^task-runtime]:
```241:515:apps/app/src/contexts/task-runtime.tsx
const selectTask = (taskId: string | "new-conversation") => { setSelectedTaskId(taskId); };
const stopGeneration = (taskId: string) => { activeIterators.current[taskId]?.cancel(); /* ... */ };
const sendMessage = async (message: string) => {
  setComposerStates((prev) => ({ ...prev, [selectedTaskId]: { ...prev[selectedTaskId], prompt: "" } }));
  const agentIterator = window.api.agent.run({
    options: { messages: chatMessages, runConfig: { cwd }, threadId: taskId },
    systemPrompt: agent?.system_prompt,
    path: claudeCode.selectedInstallation?.path,
    mcpServers: userMcps.reduce(/* ... */),
    env: claudeCode.selectedInstallation?.source === "bundled" ? {
      ANTHROPIC_BASE_URL: `${import.meta.env.VITE_SERVER_URL}/cc-proxy`,
      ANTHROPIC_API_KEY: token,
    } : undefined,
  });
  activeIterators.current[taskId] = agentIterator;
  for await (const reply of agentIterator) {
    z.mutate.message.update({ task_id: taskId, message_id: replyId, role: reply.role, content: reply.content, metadata: reply.providerOptions ?? {} });
  }
};
```

[^update-context]:
```54:188:apps/app/src/contexts/update-context.tsx
export function UpdateProvider({ children }: UpdateProviderProps) {
  const [state, setState] = useState<UpdateState>("idle");
  useEffect(() => {
    if (!window.electron) return;
    const removeCheckingListener = window.electron.ipcRenderer.on("auto-updater:update-checking", () => setState("checking"));
    const removeAvailableListener = window.electron.ipcRenderer.on("auto-updater:update-available", (_, info) => { setState("available"); setUpdateInfo(info); });
    const removeProgressListener = window.electron.ipcRenderer.on("auto-updater:update-download-progress", (_, progressData) => { setState("downloading"); setProgress(progressData); });
    const removeDownloadedListener = window.electron.ipcRenderer.on("auto-updater:update-downloaded", (_, info) => { setState("downloaded"); setUpdateInfo(info); });
    const removeErrorListener = window.electron.ipcRenderer.on("auto-updater:update-error", (_, errorInfo) => { setState("error"); setError(errorInfo); });
    return () => { removeCheckingListener(); removeAvailableListener(); removeProgressListener(); removeDownloadedListener(); removeErrorListener(); };
  }, []);
  return <UpdateContext.Provider value={{ state, updateInfo, progress, error, checkForUpdates, quitAndInstall }}>{children}</UpdateContext.Provider>;
}
```

### 5.2 Hooks & Utilities

- **`useApi`** wraps Axios with Clerk bearer token injection for server calls.[^use-api]
- **`useImageColor`** extracts dominant colors for MCP logos to tint UI cards.[^use-image-color]
- **`useKeyboardNavigation`** adds global arrow-key navigation respecting dialogs/forms.[^use-keyboard-navigation]
- **`useZero`**, **`useScrollGradients`**, and **`useIsMobile`** provide Zero access, gradient overlays for scroll containers, and responsive flags, respectively.

[^use-api]:
```1:46:apps/app/src/lib/api.ts
export const useApi = (): AxiosInstance => {
  const { getToken } = useAuth();
  const apiRef = useRef<AxiosInstance | null>(null);
  if (!apiRef.current) {
    const instance = axios.create({ baseURL: API_BASE_URL, headers: { "Content-Type": "application/json" } });
    instance.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    apiRef.current = instance;
  }
  return apiRef.current;
};
```

[^use-image-color]:
```55:101:apps/app/src/hooks/useImageColor.ts
export const useImageColor = (imageUrl: string, customOptions: Partial<Options> = {}): UseExtractColorReturn => {
  const options: Options = { ...defaultOptions, ...customOptions };
  const [colors, setColors] = useState<string[]>([]);
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (isMounted) {
          const colors = await extractDominantColors(imageUrl, options);
          const formattedColors = formatColors(colors, options);
          setDominantColor(formattedColors.dominantColor);
          setColors(formattedColors.colors);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [imageUrl]);
  return { dominantColor, darkerColor, lighterColor, loading, error, colors };
};
```

[^use-keyboard-navigation]:
```11:75:apps/app/hooks/useKeyboardNavigation.ts
export function useKeyboardNavigation<T>({ items, selectedId, onSelect, getItemId, prependIds = [] }: UseKeyboardNavigationProps<T>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT","TEXTAREA","SELECT"].includes(target.tagName))) return;
      e.preventDefault();
      const allItemIds = [...prependIds, ...(items || []).map(getItemId)];
      const currentIndex = allItemIds.indexOf(selectedId);
      const nextIndex = e.key === "ArrowDown" ? Math.min(currentIndex + 1, allItemIds.length - 1) : Math.max(currentIndex - 1, 0);
      if (nextIndex !== currentIndex && allItemIds[nextIndex]) {
        onSelect(allItemIds[nextIndex]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedId, onSelect, getItemId, prependIds]);
}
```

### 5.3 AI/UX Components

- **Conversation stack**: `Conversation`, `ConversationContent`, `ConversationScrollButton`, and `ConversationEmptyState` build stick-to-bottom chat panes.
- **Messaging primitives**: `Message`, `MessageContent`, `MessageAvatar`, `Response`, `Tool`, `ToolInput`, `ToolOutput` render user/assistant/tool output with consistent styling.[^message-tool]
- **Prompt composer**: `PromptInput`, `PromptInputTextarea`, rich attachment helpers, and the contextual `PromptMenu` manage hotkeys (`@` trigger), attachments, streaming states, and submission control.[^prompt-input]
- **TaskWindow**: orchestrates the entire composer, permission prompts, virtualization, and gradient overlays using the above primitives.[^task-window]
- **AgentsContent** & **MCPContent**: CRUD dashboards for agents and MCP integrations, each built on Zero queries/mutators.[^agents-content][^mcp-card]
- **CommandMenu**: global command palette with hierarchical context items, key sequences, and theme commands.[^command-menu]
- **AppSidebar**, **NavUser**, **NavWallet**, **NavMain**, **NavSecondary**, **SiteHeader** build the workspace shell.
- **Guard** handles desktop sign-in flows via deep links and Clerk `ticket` strategy.[^guard]
- **UpdateToast** pipes `useUpdate` state into Sonner toasts.[^update-toast]

[^message-tool]:
```19:181:apps/app/components/message.tsx
export const AssistantMessage = ({ message }: AssistantMessageProps) => {
  if (typeof message.content === "string") {
    return <Response>{message.content}</Response>;
  }
  const parts = message.content as Exclude<AssistantContent, string>;
  const contents = message.content.map((content, index) => {
    switch (content.type) {
      case "text":
        return <Response key={index} className="text-sm pb-2 leading-7">{content.text}</Response>;
      case "tool-call": {
        const result = parts.find((part): part is ToolResultPart => part.type === "tool-result" && part.toolCallId === content.toolCallId);
        return (
          <Tool key={index} className="rounded-2xl">
            <ToolHeader type={`tool-${content.toolName}`} state={result ? "output-available" : "input-available"} />
            <ToolContent>
              <ToolInput input={content.input} />
              {result && <ToolOutput errorText={undefined} output={result.output} />}
            </ToolContent>
          </Tool>
        );
      }
    }
  });
  return <>{...contents}</>;
};
```

[^prompt-input]:
```222:475:apps/app/components/ai-elements/prompt-input.tsx
export const PromptInput = ({ onSubmit, children, ...props }: PromptInputProps) => {
  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const add = useCallback((files: File[] | FileList) => { /* validate accept/maxFiles/maxFileSize, create blob URLs */ }, []);
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = (formData.get("message") as string) || "";
    Promise.all(items.map(async ({ id, ...item }) => item.url?.startsWith("blob:") ? { ...item, url: await convertBlobUrlToDataUrl(item.url) } : item))
      .then((files: FileUIPart[]) => { onSubmit({ text, files }, event); clear(); });
  };
  return (
    <AttachmentsContext.Provider value={ctx}>
      <form className="w-full overflow-hidden rounded-xl border bg-background shadow-sm" onSubmit={handleSubmit} {...props}>
        {children}
      </form>
    </AttachmentsContext.Provider>
  );
};
```

[^task-window]:
See the `TaskRuntimeProvider` snippet above and `task-window.tsx` for the UI composition.[^task-runtime]

[^agents-content]:
```35:390:apps/app/components/agents-content.tsx
const handleCreateAgent = async () => {
  const agentId = nanoid();
  const result = z.mutate.agents.create({ agent_id: agentId, name: newAgentName, system_prompt: "", base_agent: "claude-code" });
  await result.client;
  setSelectedAgentId(agentId);
};
const handleUpdateAgent = async (updates: Partial<NewAgent>) => {
  if (!selectedAgentId) return;
  await z.mutate.agents.update({ agent_id: selectedAgentId, ...updates });
};
const handleDeleteAgent = async () => {
  await z.mutate.agents.delete({ agent_id: selectedAgentId });
};
```

[^mcp-card]:
```37:211:apps/app/components/mcp-card.tsx
const handleConnect = async () => {
  setIsConnecting(true);
  const token = await getToken({ template: "cc-proxy", skipCache: true });
  const response = await fetch(`${SERVER_URL}/api/mcp/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mcp_store_id: mcpStoreItem.id }),
  });
  const { authorizationUrl } = await response.json();
  window.api.browser.openUrl(authorizationUrl);
};
const handleConfirmDisconnect = async () => {
  await z.mutate.mcps.delete({ mcp_id: connectedMcp!.id });
};
```

[^command-menu]:
```82:423:apps/app/components/command-menu.tsx
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen((prevOpen) => !prevOpen);
      return;
    }
    if (!open && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const key = e.key.toLowerCase();
      const newSequence = shouldReset ? [key] : [...keySequence, key];
      for (const group of commands) {
        for (const item of group.items) {
          if (item.shortcut && shortcutKeys.every((k, i) => k === newSequence[i])) {
            e.preventDefault();
            runCommand(item);
            setKeySequence([]);
            return;
          }
        }
      }
    }
  };
  document.addEventListener("keydown", down);
  return () => document.removeEventListener("keydown", down);
}, [open, commands, keySequence, runCommand, setOpen]);
```

[^guard]:
```7:123:apps/app/components/guard.tsx
useEffect(() => {
  const remove = window.api.auth.onTokenReceived(async (ticket) => {
    const signInAttempt = await signIn.create({ strategy: "ticket", ticket });
    if (signInAttempt.status === "complete") {
      setActive({ session: signInAttempt.createdSessionId });
    } else {
      toast.error("Error authorising desktop application");
    }
  });
  return remove;
}, []);
```

[^update-toast]:
```5:75:apps/app/components/update-toast.tsx
useEffect(() => {
  if (isUpdateAvailable && !isDownloading && !isUpdateReady) {
    toast.info(`Update Available: ${version} is downloading...`, { id: "update-available", duration: Infinity });
  }
}, [isUpdateAvailable, isDownloading, isUpdateReady, updateInfo]);
useEffect(() => {
  if (isUpdateReady) {
    toast.success(`${version} downloaded. Click to restart and install.`, {
      id: "update-ready",
      duration: Infinity,
      action: { label: "Restart Now", onClick: quitAndInstall },
    });
  }
}, [isUpdateReady, quitAndInstall, updateInfo]);
```

### 5.4 UI Primitives

The `components/ui/*` directory is a curated shadcn-based toolkit (button, card, dialog, dropdown, select, textarea, tooltip, sidebar, etc.) wrapped with Tailwind defaults and minor UX enhancements (e.g., `Button` supports hotkeys, `Input` preconfigures accessibility states). Import them directly (`import { Button } from "@/components/ui/button"`) to match the rest of the application.

---

## 6. Putting It Together

When implementing new features:

1. **Shared contract first**: extend `packages/shared` (channels, contracts, window typings) before touching shell or renderer.
2. **Shell handler**: register IPC handlers in `apps/shell/src/main/ipc` and expose them via preload.
3. **Server endpoints**: reuse `BillingService`, `OAuthService`, `SyncService`, etc. so wallet gating, MCP records, and analytics stay consistent.
4. **Data sync**: prefer Zero queries/mutators to keep real-time clients in sync and analytics flowing through `server-mutators`.
5. **Renderer UI**: compose contexts + hooks + UI primitives described above; rely on `TaskRuntimeProvider`, `PromptInput`, and design system components for consistent UX.

Refer back to the cited modules for the complete implementation details whenever you add new APIs or reuse existing ones.
