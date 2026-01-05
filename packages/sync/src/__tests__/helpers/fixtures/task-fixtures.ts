/**
 * Test fixtures for task-related entities: tasks, turns, blocks
 */

export interface TaskFixture {
  id: string;
  name: string;
  organisation_id: string;
  author_id: string;
  created_at: number;
  updated_at: number;
  status: "available" | "starting" | "executing" | "stopping";
  runtime_id: string;
  last_session_id: string | null;
  metadata: { cwd?: string } | null;
}

export interface TurnFixture {
  id: string;
  type: "user" | "assistant";
  complete: boolean;
  locked: boolean;
  task_id: string;
  created_at: number;
  updated_at: number;
  metadata: any;
}

export interface BlockFixture {
  id: string;
  turn_id: string;
  type:
    | "text"
    | "tool_use"
    | "tool_result"
    | "server_tool_use"
    | "thinking";
  status:
    | "none"
    | "permission_pending"
    | "client_pending"
    | "server_pending"
    | "mcp_pending"
    | "completed";
  complete: boolean;
  content: any;
  created_at: number;
  updated_at: number;
  processed: boolean;
  metadata: any;
  response_turn_id: string | null;
}

export function createTaskFixture(
  overrides: Partial<TaskFixture> = {}
): TaskFixture {
  return {
    id: "task-1",
    name: "Test Task",
    organisation_id: "test-org-id",
    author_id: "test-user-id",
    created_at: Date.now(),
    updated_at: Date.now(),
    status: "available",
    runtime_id: "runtime-1",
    last_session_id: "session-1",
    metadata: { cwd: "/home/user" },
    ...overrides,
  };
}

export function createTurnFixture(
  overrides: Partial<TurnFixture> = {}
): TurnFixture {
  return {
    id: "turn-1",
    type: "user",
    complete: false,
    locked: false,
    task_id: "task-1",
    created_at: Date.now(),
    updated_at: Date.now(),
    metadata: null,
    ...overrides,
  };
}

export function createBlockFixture(
  overrides: Partial<BlockFixture> = {}
): BlockFixture {
  return {
    id: "block-1",
    turn_id: "turn-1",
    type: "text",
    status: "none",
    complete: false,
    content: { type: "text", text: "Hello" },
    created_at: Date.now(),
    updated_at: Date.now(),
    processed: false,
    metadata: null,
    response_turn_id: null,
    ...overrides,
  };
}

export function createToolUseBlockFixture(
  overrides: Partial<BlockFixture> = {}
): BlockFixture {
  return createBlockFixture({
    id: "tool-block-1",
    type: "tool_use",
    status: "permission_pending",
    content: {
      type: "tool_use",
      id: "tool-use-123",
      name: "bash",
      input: { command: "ls" },
    },
    complete: true,
    ...overrides,
  });
}

export function createServerToolUseBlockFixture(
  overrides: Partial<BlockFixture> = {}
): BlockFixture {
  return createBlockFixture({
    id: "server-tool-block-1",
    type: "server_tool_use",
    status: "permission_pending",
    content: {
      type: "server_tool_use",
      id: "server-tool-use-123",
      name: "web_search",
      input: { query: "test" },
    },
    complete: true,
    ...overrides,
  });
}

export function createToolResultBlockFixture(
  overrides: Partial<BlockFixture> = {}
): BlockFixture {
  return createBlockFixture({
    id: "result-block-1",
    type: "tool_result",
    status: "none",
    content: {
      type: "tool_result",
      tool_use_id: "tool-use-123",
      content: "file1.txt\nfile2.txt",
      is_error: false,
    },
    complete: true,
    ...overrides,
  });
}
