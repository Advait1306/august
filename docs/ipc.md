# IPC System Documentation

## Overview

The IPC (Inter-Process Communication) system in this Electron application follows a three-layer architecture:

```
App (Renderer) → Preload → Main Process
```

All IPC types and channel names are centralized in `@jupiter/shared` to ensure type safety across the entire IPC boundary.

## Architecture

### Layer 1: Shared Package (`@jupiter/shared`)

**Location:** `packages/shared/src/`

Contains all type definitions and constants used across the IPC boundary:

```
packages/shared/src/
├── types/
│   ├── agent.ts          # AgentTypes interface
│   ├── claude.ts         # ClaudeInstallation interface
│   ├── common.ts         # PermissionRequest, Permission
│   ├── project.ts        # Project, ProjectUpdate
│   ├── window.ts         # Global Window interface
│   └── index.ts          # Exports all types
├── ipc/
│   ├── channels.ts       # IPC channel name constants
│   ├── contracts.ts      # Request/response type contracts
│   └── index.ts          # Exports all IPC definitions
└── types.ts              # Re-exports everything
```

### Layer 2: Main Process (`apps/shell/src/main`)

**Location:** `apps/shell/src/main/ipc/`

Implements IPC handlers that respond to renderer requests:

```
apps/shell/src/main/ipc/
├── agents.ts         # Agent-related handlers
├── projects.ts       # Project selection handlers
├── auth.ts           # Authentication handlers
└── auto-updater.ts   # Auto-updater handlers
```

### Layer 3: Preload Script (`apps/shell/src/preload`)

**Location:** `apps/shell/src/preload/`

Exposes safe IPC methods to the renderer process:

```
apps/shell/src/preload/
├── agent.ts      # Agent IPC implementation
├── index.ts      # API object exposed to renderer
└── index.d.ts    # Type definitions (imports from shared)
```

### Layer 4: App (Renderer) (`apps/app/src`)

**Location:** `apps/app/src/`

Consumes the IPC API through `window.api`:

```typescript
// Access IPC methods
const result = await window.api.projects.selectFolder();
```

## Type System

### 1. Channel Names (`packages/shared/src/ipc/channels.ts`)

Centralized constants for all IPC channel names:

```typescript
export const IPC_CHANNELS = {
  AGENT: {
    RUN: 'agent:run',
    PERMISSION_REQUEST: 'permission:request',
    PERMISSION_RESPONSE: 'permission:response',
  },
  PROJECTS: {
    SELECT_FOLDER: 'projects:selectFolder',
  },
  // ... more channels
} as const;
```

### 2. Type Contracts (`packages/shared/src/ipc/contracts.ts`)

Type-safe request/response definitions for each IPC channel:

```typescript
export namespace IPC {
  export namespace Projects {
    export type SelectFolderResponse = {
      name: string;
      path: string;
    } | null;
  }

  export namespace Auth {
    export type OpenLoginResponse = boolean;
    export type TicketReceivedEvent = string;
  }
}
```

### 3. Window API Types (`packages/shared/src/types/window.ts`)

Global type definition for the renderer `window.api` object:

```typescript
declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      projects: {
        selectFolder: () => Promise<Project | null>;
      };
      auth: {
        openLogin: () => Promise<boolean>;
        onTokenReceived: (callback: (token: string) => void) => () => void;
      };
      // ... more APIs
    };
  }
}
```

## Adding a New IPC Channel

Follow these steps to add a new IPC channel with full type safety:

### Step 1: Define Channel Name

**File:** `packages/shared/src/ipc/channels.ts`

```typescript
export const IPC_CHANNELS = {
  // ... existing channels
  MY_FEATURE: {
    DO_SOMETHING: 'my-feature:do-something',
    GET_DATA: 'my-feature:get-data',
  },
} as const;
```

### Step 2: Define Type Contracts

**File:** `packages/shared/src/ipc/contracts.ts`

```typescript
export namespace IPC {
  // ... existing namespaces

  export namespace MyFeature {
    export interface DoSomethingRequest {
      param1: string;
      param2: number;
    }

    export interface DoSomethingResponse {
      success: boolean;
      data?: any;
      error?: string;
    }

    export interface GetDataResponse {
      items: Array<{ id: string; name: string }>;
    }
  }
}
```

### Step 3: Implement Main Process Handler

**File:** `apps/shell/src/main/ipc/my-feature.ts`

```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc';

export function registerMyFeatureIpcHandlers(): void {
  // Handler with request parameters
  ipcMain.handle(
    IPC_CHANNELS.MY_FEATURE.DO_SOMETHING,
    async (
      _event,
      request: IPC.MyFeature.DoSomethingRequest
    ): Promise<IPC.MyFeature.DoSomethingResponse> => {
      try {
        // Implementation
        const result = await doSomething(request.param1, request.param2);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  );

  // Handler without parameters
  ipcMain.handle(
    IPC_CHANNELS.MY_FEATURE.GET_DATA,
    async (): Promise<IPC.MyFeature.GetDataResponse> => {
      const items = await fetchData();
      return { items };
    }
  );
}
```

**Register the handler in:** `apps/shell/src/main/index.ts`

```typescript
import { registerMyFeatureIpcHandlers } from './ipc/my-feature';

// In your initialization code
registerMyFeatureIpcHandlers();
```

### Step 4: Implement Preload Script

**File:** `apps/shell/src/preload/index.ts`

```typescript
import { IPC_CHANNELS } from '@jupiter/shared/ipc';
import { electronAPI } from '@electron-toolkit/preload';

const api = {
  // ... existing APIs
  myFeature: {
    doSomething: (param1: string, param2: number) =>
      electronAPI.ipcRenderer.invoke(
        IPC_CHANNELS.MY_FEATURE.DO_SOMETHING,
        { param1, param2 }
      ),
    getData: () =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.MY_FEATURE.GET_DATA)
  }
};
```

### Step 5: Update Window Type Definition

**File:** `packages/shared/src/types/window.ts`

```typescript
declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      // ... existing APIs
      myFeature: {
        doSomething: (
          param1: string,
          param2: number
        ) => Promise<IPC.MyFeature.DoSomethingResponse>;
        getData: () => Promise<IPC.MyFeature.GetDataResponse>;
      };
    };
  }
}
```

### Step 6: Use in Renderer

**File:** Any file in `apps/app/src/`

```typescript
// Call the IPC method
const result = await window.api.myFeature.doSomething('test', 42);

if (result.success) {
  console.log('Success!', result.data);
} else {
  console.error('Error:', result.error);
}

// Get data
const { items } = await window.api.myFeature.getData();
console.log('Items:', items);
```

### Step 7: Rebuild Shared Package

After making changes to the shared package, rebuild it:

```bash
cd packages/shared
npm run build
```

## IPC Patterns

### Pattern 1: Request-Response (Simple)

**Use case:** Simple data fetching or operations

**Example:** Getting a list of items

```typescript
// Main Process
ipcMain.handle(IPC_CHANNELS.ITEMS.GET_ALL, async () => {
  return { items: await getItems() };
});

// Renderer
const { items } = await window.api.items.getAll();
```

### Pattern 2: Request-Response (With Parameters)

**Use case:** Operations that require input

**Example:** Deleting an item by ID

```typescript
// Main Process
ipcMain.handle(
  IPC_CHANNELS.ITEMS.DELETE,
  async (_event, id: string): Promise<{ success: boolean }> => {
    await deleteItem(id);
    return { success: true };
  }
);

// Renderer
const result = await window.api.items.delete('item-123');
```

### Pattern 3: Event Listeners (Main → Renderer)

**Use case:** Pushing updates from main to renderer

**Example:** Authentication token received

```typescript
// Main Process
import { BrowserWindow } from 'electron';

function sendAuthToken(mainWindow: BrowserWindow, token: string) {
  mainWindow.webContents.send(IPC_CHANNELS.AUTH.TICKET_RECEIVED, token);
}

// Preload
const api = {
  auth: {
    onTokenReceived: (callback: (token: string) => void) => {
      electronAPI.ipcRenderer.on(
        IPC_CHANNELS.AUTH.TICKET_RECEIVED,
        (_, token) => callback(token)
      );
      return () => {
        electronAPI.ipcRenderer.removeAllListeners(
          IPC_CHANNELS.AUTH.TICKET_RECEIVED
        );
      };
    }
  }
};

// Renderer
useEffect(() => {
  const removeListener = window.api.auth.onTokenReceived((token) => {
    console.log('Token received:', token);
  });

  return () => removeListener();
}, []);
```

### Pattern 4: Async Generators (Streaming)

**Use case:** Long-running operations that yield multiple results

**Example:** Agent streaming responses

```typescript
// Main Process
ipcMain.handle(IPC_CHANNELS.AGENT.RUN, async (event, id, options) => {
  for await (const message of agent.run(options)) {
    asyncGeneratorOverIPCSender(event, id, message);
  }
  asyncGeneratorOverIPCCloser(event, id);
});

// Preload
run: (options) => {
  return asyncGeneratorOverIPCConsumer((id) => {
    electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AGENT.RUN, id, options);
  });
}

// Renderer
for await (const reply of window.api.agent.run(options)) {
  console.log('Reply:', reply);
}
```

## Best Practices

### 1. Always Use Channel Constants

❌ **Don't:**
```typescript
ipcMain.handle('projects:selectFolder', async () => { ... });
```

✅ **Do:**
```typescript
ipcMain.handle(IPC_CHANNELS.PROJECTS.SELECT_FOLDER, async () => { ... });
```

### 2. Always Type Request/Response

❌ **Don't:**
```typescript
ipcMain.handle('getData', async (_event, params: any): Promise<any> => {
  return await fetchData(params);
});
```

✅ **Do:**
```typescript
ipcMain.handle(
  IPC_CHANNELS.DATA.GET,
  async (
    _event,
    params: IPC.Data.GetRequest
  ): Promise<IPC.Data.GetResponse> => {
    return await fetchData(params);
  }
);
```

### 3. Group Related Channels

Group related IPC channels under a namespace:

```typescript
export const IPC_CHANNELS = {
  PROJECTS: {
    SELECT_FOLDER: 'projects:selectFolder',
    CREATE: 'projects:create',
    UPDATE: 'projects:update',
    DELETE: 'projects:delete',
  },
} as const;
```

### 4. Use Consistent Response Format

For operations that can fail, use a consistent response format:

```typescript
export interface OperationResponse {
  success: boolean;
  error?: string;
}

export interface DataResponse<T> extends OperationResponse {
  data?: T;
}
```

### 5. Clean Up Event Listeners

Always return a cleanup function from event listeners:

```typescript
const api = {
  onEvent: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.on('event', (_, data) => callback(data));

    // Return cleanup function
    return () => {
      electronAPI.ipcRenderer.removeAllListeners('event');
    };
  }
};
```

### 6. Rebuild After Changes

After modifying any shared types or IPC definitions:

```bash
cd packages/shared
npm run build
```

Then verify TypeScript compilation:

```bash
# From project root
npx tsc --noEmit --project apps/shell/tsconfig.json
npx tsc --noEmit --project apps/app/tsconfig.json
```

## Troubleshooting

### "Cannot find module" errors

**Problem:** Getting module resolution errors when running the app.

**Solution:** Ensure the shared package is built:
```bash
cd packages/shared
npm run build
```

### Type errors in renderer

**Problem:** `window.api` types not recognized in renderer.

**Solution:** Ensure `packages/shared/src/types/window.ts` is imported in the app:
```typescript
// apps/app/src/types/window.d.ts
import "@jupiter/shared/types";
```

### IPC handler not responding

**Problem:** IPC calls timeout or don't receive responses.

**Solution:**
1. Verify the handler is registered in `apps/shell/src/main/index.ts`
2. Check that the channel name matches exactly
3. Ensure you're using `ipcMain.handle()` not `ipcMain.on()`

### TypeScript errors after adding new types

**Problem:** New types cause compilation errors.

**Solution:**
1. Rebuild shared package: `cd packages/shared && npm run build`
2. Restart your IDE/editor TypeScript server
3. Check for circular dependencies in imports

## Summary

The IPC system provides:

✅ **Type Safety** - Full TypeScript coverage across IPC boundary
✅ **Single Source of Truth** - All types in `@jupiter/shared`
✅ **No Magic Strings** - Centralized channel name constants
✅ **Consistent Patterns** - Standardized request/response formats
✅ **Easy to Extend** - Clear process for adding new channels
✅ **Maintainable** - Changes in one place propagate everywhere
