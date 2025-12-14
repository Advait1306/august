import { describe, it, expect, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { runAgentLoop } from "../core";

/**
 * Creates a mock stream that yields events as an async iterable
 */
function createMockStream(events: BetaRawMessageStreamEvent[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    },
  };
}

/**
 * Creates a mock Anthropic client with the given stream responses
 * Each call to messages.create will return the next stream in the array
 */
function createMockClient(streams: BetaRawMessageStreamEvent[][]) {
  let callIndex = 0;
  return {
    beta: {
      messages: {
        create: vi.fn().mockImplementation(() => {
          const stream = streams[callIndex] ?? streams[streams.length - 1];
          callIndex++;
          return Promise.resolve(createMockStream(stream!));
        }),
      },
    },
  } as unknown as Anthropic;
}

/**
 * Helper to create text streaming events
 */
function createTextEvents(text: string, index = 0): BetaRawMessageStreamEvent[] {
  return [
    {
      type: "content_block_start",
      index,
      content_block: { type: "text", text: "" },
    } as BetaRawMessageStreamEvent,
    {
      type: "content_block_delta",
      index,
      delta: { type: "text_delta", text },
    } as BetaRawMessageStreamEvent,
    {
      type: "content_block_stop",
      index,
    } as BetaRawMessageStreamEvent,
  ];
}

/**
 * Helper to create tool use streaming events
 */
function createToolUseEvents(
  toolId: string,
  toolName: string,
  input: Record<string, unknown>,
  index = 0
): BetaRawMessageStreamEvent[] {
  return [
    {
      type: "content_block_start",
      index,
      content_block: { type: "tool_use", id: toolId, name: toolName, input: {} },
    } as BetaRawMessageStreamEvent,
    {
      type: "content_block_delta",
      index,
      delta: { type: "input_json_delta", partial_json: JSON.stringify(input) },
    } as BetaRawMessageStreamEvent,
    {
      type: "content_block_stop",
      index,
    } as BetaRawMessageStreamEvent,
  ];
}

describe("runAgentLoop", () => {
  describe("text responses", () => {
    it("should return final text response when no tools are called", async () => {
      const mockClient = createMockClient([createTextEvents("Hello, world!")]);

      const result = await runAgentLoop({
        messages: [{ role: "user", content: "Say hello" }],
        client: mockClient,
      });

      expect(result.finalResponse).toBe("Hello, world!");
      expect(result.toolCalls).toHaveLength(0);
    });

    it("should invoke onText callback for streamed text", async () => {
      const mockClient = createMockClient([createTextEvents("Hello!")]);
      const onText = vi.fn();

      await runAgentLoop({
        messages: [{ role: "user", content: "Say hello" }],
        client: mockClient,
        onText,
      });

      expect(onText).toHaveBeenCalledWith("Hello!");
    });

    it("should concatenate multiple text blocks", async () => {
      const events: BetaRawMessageStreamEvent[] = [
        ...createTextEvents("First ", 0),
        ...createTextEvents("Second", 1),
      ];
      const mockClient = createMockClient([events]);

      const result = await runAgentLoop({
        messages: [{ role: "user", content: "Test" }],
        client: mockClient,
      });

      expect(result.finalResponse).toBe("First \nSecond");
    });
  });

  describe("tool execution", () => {
    it("should execute tools and continue the loop", async () => {
      // First response: tool call for ls
      const firstResponse = createToolUseEvents("tool-1", "ls", { path: "/tmp" });

      // Second response: text after tool result
      const secondResponse = createTextEvents("I listed the directory.");

      const mockClient = createMockClient([firstResponse, secondResponse]);

      const result = await runAgentLoop({
        messages: [{ role: "user", content: "List /tmp" }],
        client: mockClient,
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]!.name).toBe("ls");
      expect(result.toolCalls[0]!.isError).toBe(false);
      expect(result.finalResponse).toBe("I listed the directory.");
    });

    it("should invoke onToolStart and onToolResult callbacks", async () => {
      const firstResponse = createToolUseEvents("tool-1", "ls", { path: "/tmp" });
      const secondResponse = createTextEvents("Done.");

      const mockClient = createMockClient([firstResponse, secondResponse]);
      const onToolStart = vi.fn();
      const onToolResult = vi.fn();

      await runAgentLoop({
        messages: [{ role: "user", content: "List /tmp" }],
        client: mockClient,
        onToolStart,
        onToolResult,
      });

      expect(onToolStart).toHaveBeenCalledWith("ls");
      expect(onToolResult).toHaveBeenCalledWith("ls", expect.any(String), false);
    });

    it("should handle multiple tool calls in sequence", async () => {
      // First response: two tool calls
      const firstResponse = [
        ...createToolUseEvents("tool-1", "ls", { path: "/tmp" }, 0),
        ...createToolUseEvents("tool-2", "glob", { pattern: "*.txt" }, 1),
      ];

      // Second response: final text
      const secondResponse = createTextEvents("Both tools executed.");

      const mockClient = createMockClient([firstResponse, secondResponse]);

      const result = await runAgentLoop({
        messages: [{ role: "user", content: "List and glob" }],
        client: mockClient,
      });

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0]!.name).toBe("ls");
      expect(result.toolCalls[1]!.name).toBe("glob");
      expect(result.finalResponse).toBe("Both tools executed.");
    });
  });

  describe("error handling", () => {
    it("should handle unknown tools gracefully", async () => {
      const firstResponse = createToolUseEvents("tool-1", "unknown_tool", {});
      const secondResponse = createTextEvents("Tool not found.");

      const mockClient = createMockClient([firstResponse, secondResponse]);

      const result = await runAgentLoop({
        messages: [{ role: "user", content: "Use unknown tool" }],
        client: mockClient,
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]!.name).toBe("unknown_tool");
      expect(result.toolCalls[0]!.isError).toBe(true);
      expect(result.toolCalls[0]!.result).toBe("Unknown tool: unknown_tool");
    });

    it("should handle tool execution errors", async () => {
      // Use ls with an invalid path that will throw
      const firstResponse = createToolUseEvents("tool-1", "ls", {
        path: "/nonexistent/path/that/should/fail",
      });
      const secondResponse = createTextEvents("Error handled.");

      const mockClient = createMockClient([firstResponse, secondResponse]);

      const result = await runAgentLoop({
        messages: [{ role: "user", content: "List invalid path" }],
        client: mockClient,
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]!.isError).toBe(true);
    });

    it("should throw when max iterations exceeded", async () => {
      // Always return a tool call, never ending
      const toolResponse = createToolUseEvents("tool-1", "ls", { path: "/tmp" });
      const mockClient = createMockClient([toolResponse]);

      await expect(
        runAgentLoop({
          messages: [{ role: "user", content: "Loop forever" }],
          client: mockClient,
          maxIterations: 3,
        })
      ).rejects.toThrow("Agent loop exceeded maximum iterations (3)");
    });
  });

  describe("message accumulation", () => {
    it("should accumulate messages through the loop", async () => {
      const firstResponse = createToolUseEvents("tool-1", "ls", { path: "/tmp" });
      const secondResponse = createTextEvents("Done.");

      const mockClient = createMockClient([firstResponse, secondResponse]);
      const messages = [{ role: "user" as const, content: "List /tmp" }];

      const result = await runAgentLoop({
        messages,
        client: mockClient,
      });

      // Original user message + assistant with tool use + user with tool result + final assistant
      expect(result.messages.length).toBeGreaterThan(1);
    });
  });

  describe("JSON parsing", () => {
    it("should handle malformed JSON in tool input gracefully", async () => {
      // Create events with invalid JSON delta
      const events: BetaRawMessageStreamEvent[] = [
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "tool_use", id: "tool-1", name: "ls", input: {} },
        } as BetaRawMessageStreamEvent,
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: "not valid json{" },
        } as BetaRawMessageStreamEvent,
        {
          type: "content_block_stop",
          index: 0,
        } as BetaRawMessageStreamEvent,
      ];

      const secondResponse = createTextEvents("Handled bad JSON.");
      const mockClient = createMockClient([events, secondResponse]);

      // Should not throw, should handle gracefully
      const result = await runAgentLoop({
        messages: [{ role: "user", content: "Test" }],
        client: mockClient,
      });

      // The tool should still be called with empty input
      expect(result.toolCalls).toHaveLength(1);
    });
  });
});
