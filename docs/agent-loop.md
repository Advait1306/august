# Agent Loop Architecture

This document explains how the agent loop in `@august/harness` works, including all Anthropic API streaming events, programmatic tool calling, and MCP integration.

## Overview

The agent loop (`packages/harness/src/agent-loop.ts`) is an async generator that streams responses from the Anthropic API. The core (`apps/litmus/src/core.ts`) consumes these events, executes tools, and manages the conversation loop.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │────▶│   core.ts    │────▶│  agent-loop  │
│   Message    │     │  (executor)  │     │  (streamer)  │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            │                    ▼
                            │              ┌──────────────┐
                            │              │  Anthropic   │
                            │              │     API      │
                            │              └──────────────┘
                            │                    │
                            ▼                    │
                     ┌──────────────┐            │
                     │  Tool        │◀───────────┘
                     │  Execution   │   (tool_use blocks)
                     └──────────────┘
```

## Streaming Event Types

The Anthropic API uses Server-Sent Events (SSE). Here are all event types:

### 1. `message_start`

First event in every stream. Contains a `Message` object with empty `content` array.

```json
{
  "type": "message_start",
  "message": {
    "id": "msg_...",
    "type": "message",
    "role": "assistant",
    "content": [],
    "model": "claude-sonnet-4-5-20250929",
    "stop_reason": null,
    "usage": { "input_tokens": 25, "output_tokens": 1 }
  }
}
```

**Special cases:**
- May contain `container` field (for code execution persistence)
- May contain prefilled `content` array (when continuing a paused turn)

**Our handling (`agent-loop.ts:223-236`):**
```typescript
if (event.type === "message_start") {
  if (message.container) {
    yield { type: "container_info", container: message.container };
  }
  if (message.content?.length > 0) {
    yield { type: "prefilled_content", content: message.content };
  }
}
```

### 2. `content_block_start`

Marks the beginning of a content block. Each block has an `index` corresponding to its position in the final `content` array.

**Content block types:**

| Type | Description |
|------|-------------|
| `text` | Claude's text response |
| `tool_use` | Direct or programmatic tool call (client executes) |
| `server_tool_use` | Server-side tool like `code_execution` (Anthropic executes) |
| `code_execution_tool_result` | Result from code execution |
| `web_search_tool_result` | Result from web search |
| `thinking` | Extended thinking content |

```json
// Text block
{ "type": "content_block_start", "index": 0, "content_block": { "type": "text", "text": "" } }

// Tool use block
{ "type": "content_block_start", "index": 1, "content_block": { "type": "tool_use", "id": "toolu_...", "name": "get_weather", "input": {} } }

// Server tool use (code execution)
{ "type": "content_block_start", "index": 1, "content_block": { "type": "server_tool_use", "id": "srvtoolu_...", "name": "code_execution", "input": {} } }
```

**Our handling (`core.ts:161-184`):**
```typescript
if (block.type === "text") {
  contentBlocks.push({ ...block, text: "" });
} else if (block.type === "tool_use") {
  // Check if input already populated (programmatic call from code execution)
  if (toolBlock.input && Object.keys(toolBlock.input).length > 0) {
    contentBlocks.push({ ...block }); // Use directly
  } else {
    contentBlocks.push({ ...block, input: {} });
    partialJsonByIndex.set(event.index, ""); // Collect JSON from deltas
  }
} else if (block.type === "server_tool_use") {
  contentBlocks.push({ ...block, input: {} });
  partialJsonByIndex.set(event.index, "");
}
```

### 3. `content_block_delta`

Incremental updates to content blocks. Delta types:

| Delta Type | For Block Type | Contains |
|------------|---------------|----------|
| `text_delta` | `text` | `{ text: "..." }` |
| `input_json_delta` | `tool_use`, `server_tool_use` | `{ partial_json: "..." }` |
| `thinking_delta` | `thinking` | `{ thinking: "..." }` |
| `signature_delta` | `thinking` | `{ signature: "..." }` |

```json
// Text delta
{ "type": "content_block_delta", "index": 0, "delta": { "type": "text_delta", "text": "Hello" } }

// Input JSON delta (partial, must accumulate)
{ "type": "content_block_delta", "index": 1, "delta": { "type": "input_json_delta", "partial_json": "{\"location\":" } }
```

**Our handling (`core.ts:185-198`):**
```typescript
if (event.delta.type === "text_delta" && block.type === "text") {
  onText?.(event.delta.text);  // Stream to UI
  block.text += event.delta.text;
} else if (event.delta.type === "input_json_delta") {
  // Accumulate partial JSON strings
  const current = partialJsonByIndex.get(event.index) ?? "";
  partialJsonByIndex.set(event.index, current + event.delta.partial_json);
}
```

### 4. `content_block_stop`

Marks the end of a content block. This is when we parse accumulated JSON.

```json
{ "type": "content_block_stop", "index": 1 }
```

**Our handling (`core.ts:199-212`):**
```typescript
if (blockType === "tool_use" || blockType === "server_tool_use") {
  if (partialJsonByIndex.has(event.index)) {
    const jsonStr = partialJsonByIndex.get(event.index) ?? "{}";
    block.input = JSON.parse(jsonStr || "{}");
  }
}
```

### 5. `message_delta`

Top-level message changes, typically at the end. Contains `stop_reason`.

```json
{ "type": "message_delta", "delta": { "stop_reason": "end_turn" }, "usage": { "output_tokens": 15 } }
```

**Stop reasons:**

| Reason | Meaning | Action |
|--------|---------|--------|
| `end_turn` | Claude finished responding | Exit loop |
| `tool_use` | Claude wants to use tools | Execute tools, continue |
| `pause_turn` | Code execution waiting for tool result | Execute tools, continue with same container |
| `max_tokens` | Hit token limit | Exit loop |
| `stop_sequence` | Hit stop sequence | Exit loop |

**Our handling (`core.ts:213-215, 229-231`):**
```typescript
if (event.type === "message_delta") {
  stopReason = event.delta.stop_reason;
}

// Later...
if (stopReason === "pause_turn") {
  continue; // Loop continues
}
```

### 6. `message_stop`

Final event, stream is complete. No data payload.

### 7. `ping`

Keep-alive event during long operations. We ignore these.

### 8. `error`

Server-side errors (e.g., `overloaded_error`).

```json
{ "type": "error", "error": { "type": "overloaded_error", "message": "Overloaded" } }
```

## Programmatic Tool Calling

Programmatic tool calling allows Claude to write Python code that calls tools, reducing round trips for multi-tool workflows.

### Setup

1. **Enable code execution tool** (`agent-loop.ts:24-27, 182-184`):
```typescript
const CODE_EXECUTION_TOOL = {
  type: "code_execution_20250825" as const,
  name: "code_execution" as const,
};

if (useProgrammaticCalling) {
  allTools = [CODE_EXECUTION_TOOL, ...allTools];
}
```

2. **Set `allowed_callers` on tools** (`agent-loop.ts:157-174`):
```typescript
if (useProgrammaticCalling) {
  return {
    ...tool,
    allowed_callers: ["code_execution_20250825"],
  };
}
```

3. **Use beta header** (`agent-loop.ts:196-199`):
```typescript
if (useProgrammaticCalling) {
  betas.push("advanced-tool-use-2025-11-20");
}
```

4. **Pass container for persistence** (`agent-loop.ts:215`):
```typescript
container, // Reuse same container across requests
```

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User sends message                                            │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Claude writes Python code that calls tools                    │
│    Response contains:                                            │
│    - server_tool_use (code_execution with Python code)          │
│    - tool_use blocks (tools called from the code)               │
│    - stop_reason: "pause_turn"                                  │
│    - container: { id: "...", expires_at: "..." }                │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. core.ts executes tool_use blocks                              │
│    - Local tools: use toolExecutors                             │
│    - MCP tools: use mcpExecutor                                 │
│    Sends tool_result messages back                              │
│    Passes same container ID                                     │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Code execution resumes in same container                      │
│    May return:                                                   │
│    - More tool_use blocks → repeat step 3                       │
│    - code_execution_tool_result → code finished                 │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Final response                                                │
│    - code_execution_tool_result with stdout/stderr              │
│    - text block with Claude's final response                    │
│    - stop_reason: "end_turn"                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Example API Response (Step 2)

```json
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "I'll query the data and analyze it." },
    {
      "type": "server_tool_use",
      "id": "srvtoolu_abc123",
      "name": "code_execution",
      "input": {
        "code": "results = await query_database('SELECT * FROM sales')\nprint(sum(r['revenue'] for r in results))"
      }
    },
    {
      "type": "tool_use",
      "id": "toolu_def456",
      "name": "query_database",
      "input": { "sql": "SELECT * FROM sales" },
      "caller": {
        "type": "code_execution_20250825",
        "tool_id": "srvtoolu_abc123"
      }
    }
  ],
  "container": { "id": "container_xyz789", "expires_at": "2025-01-15T14:30:00Z" },
  "stop_reason": "pause_turn"
}
```

### Token Efficiency

Tool results from programmatic calls are NOT added to Claude's context - only the final code output is. This makes programmatic calling significantly more token-efficient for multi-tool workflows.

## MCP Integration

MCP (Model Context Protocol) tools are external tools served by MCP servers. We connect to these servers and make their tools available for programmatic calling.

### Connection Setup (`mcp-client.ts`)

```typescript
// 1. Connect to MCP server
const client = new Client({ name: "august-harness", version: "1.0.0" }, {});
const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers } });
await client.connect(transport);

// 2. List tools
const toolsResult = await client.listTools();

// 3. Convert to Anthropic format with programmatic calling enabled
const anthropicTool = {
  name: `${serverName}__${toolName}`,  // Prefixed for uniqueness
  description: tool.description,
  input_schema: tool.inputSchema,
  allowed_callers: ["code_execution_20250825"],
};
```

### Tool Name Sanitization

Anthropic requires tool names to match `^[a-zA-Z0-9_-]{1,128}$`. We sanitize MCP tool names:

```typescript
function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
}
```

We maintain a mapping from sanitized names to original MCP tool names for execution.

### Execution Flow (`core.ts`)

```typescript
// Build lookup structures
const mcpTools = getMcpTools(mcpConnections);
const mcpExecutor = createMcpExecutor(mcpConnections);
const mcpToolNames = new Set(mcpTools.map(t => t.name));

// During tool execution
for (const toolUse of toolUseBlocks) {
  const isMcpTool = mcpToolNames.has(toolUse.name);

  if (isMcpTool && mcpExecutor) {
    const result = await mcpExecutor(toolUse.name, toolUse.input);
    // ... send tool_result
  } else {
    const executor = toolExecutors[toolUse.name];
    const result = await executor(toolUse.input);
    // ... send tool_result
  }
}
```

## Event Handling Notes

The agent loop yields raw Anthropic streaming events without any custom events. The consumer (`core.ts`) handles special cases:

- **`message_start`**: May contain `container` info (for code execution persistence) and `content` blocks (during code execution continuation)
- **`message_delta`**: May contain `container` info and `stop_reason`

Container ID must be extracted and passed to subsequent requests to maintain code execution state.

## Configuration

### AgentLoopConfig

```typescript
interface AgentLoopConfig {
  messages: BetaMessageParam[];
  tools?: (Tool | ZodToolDefinition)[];

  // Legacy: Anthropic's native MCP connector (deprecated)
  mcpServers?: BetaRequestMCPServerURLDefinition[];

  // Recommended: Pre-converted MCP tools for programmatic calling
  mcpTools?: Tool[];

  // Enable programmatic calling for all tools
  enableProgrammaticCalling?: boolean;

  model?: string;  // Default: "claude-sonnet-4-5-20250929"
  maxTokens?: number;  // Default: 8192
  client?: Anthropic;
  container?: string;  // For code execution persistence
}
```

## Summary Table

| Event | When | Our Action |
|-------|------|------------|
| `message_start` | Stream begins | Extract container, prefilled content |
| `content_block_start` | Block begins | Initialize block, setup JSON collection |
| `content_block_delta` | Block update | Append text or accumulate JSON |
| `content_block_stop` | Block ends | Parse accumulated JSON |
| `message_delta` | Message metadata | Extract stop_reason |
| `message_stop` | Stream ends | Exit event loop |

| Stop Reason | Meaning | Action |
|-------------|---------|--------|
| `end_turn` | Done | Exit agent loop |
| `tool_use` | Tools needed | Execute tools, continue |
| `pause_turn` | Code waiting | Execute tools, continue with container |
| `max_tokens` | Limit hit | Exit agent loop |
