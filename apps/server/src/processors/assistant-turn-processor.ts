import { randomUUID } from "crypto";
import {
  BetaContainer,
  BetaContentBlockParam,
  BetaRawContentBlockDeltaEvent,
  BetaRawContentBlockStartEvent,
  BetaRawContentBlockStopEvent,
  BetaRawMessageDeltaEvent,
  BetaRawMessageStartEvent,
  BetaServerToolUseBlockParam,
  BetaStopReason,
  BetaTextBlockParam,
  BetaToolUseBlockParam,
} from "@anthropic-ai/sdk/resources/beta";
import { AppState } from "../config/state";
import {
  blocks,
  blockType,
  BlockMetadata,
  tasks,
  turns,
} from "@jupiter/sync/db/schema";
import { eq } from "drizzle-orm";
import { isServerTool } from "../server-tools";
import { addToServerToolExecutorQueue } from "../queues/workers/serverToolExecutorWorker";
import { addToMcpToolExecutorQueue } from "../queues/workers/mcpToolExecutorWorker";
import { UsageService } from "../services/usage.service";

export class AssistantTurnProcessor {
  private db: AppState["db"];
  private usageService: UsageService;

  private task: {
    id: string;
    organisationId: string;
    status: "available" | "executing" | "starting";
    dirty: boolean;
  };

  // Internal state
  private turn: {
    id: string;
    metadata: {
      container?: BetaContainer;
      stopReason?: BetaStopReason;
    };
    complete: boolean;
    dirty: boolean;
  };

  private toolResponseTurn: {
    id: string;
    dirty: boolean;
  } | null = null;

  private blocks: Record<
    number,
    {
      id: string;
      dirty: boolean;
      data: {
        content: BetaContentBlockParam;
        complete: boolean;
        processed: boolean;
        status:
          | "none"
          | "permission_pending"
          | "client_pending"
          | "server_pending"
          | "mcp_pending"
          | "completed";
        metadata?: BlockMetadata;
      };
    }
  > = {};

  // Mapping from MCP tool name to MCP ID
  private toolToMcpId: Map<string, string>;

  // Model used for this request
  private model: string;

  // Usage tracking
  private messageId: string | null = null;
  private usageData: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  } | null = null;

  constructor(
    db: AppState["db"],
    taskId: string,
    organisationId: string,
    model: string,
    toolToMcpId: Map<string, string> = new Map()
  ) {
    this.db = db;
    this.usageService = new UsageService(db);
    this.toolToMcpId = toolToMcpId;
    this.model = model;
    this.task = {
      id: taskId,
      organisationId,
      status: "executing",
      dirty: true,
    };
    this.turn = {
      id: randomUUID(),
      metadata: {},
      complete: false,
      dirty: true,
    };
  }

  private setContainer(container: BetaContainer) {
    this.turn.metadata.container = container;
    this.turn.dirty = true;
  }

  private setStopReason(stopReason: BetaStopReason) {
    this.turn.metadata.stopReason = stopReason;
    this.turn.dirty = true;
  }

  /**
   * Destroys the current object and replaces its value with an empty string.
   * Should be used when partial_json is being sent for a tool use block.
   *
   * @param index - The index of the block to convert.
   *
   * Only affects the block if it's a tool where the input is an object, otherwise it does nothing.
   */
  private convertToolUseBlockInputToString(index: number) {
    if (
      (this.blocks[index].data.content.type === "tool_use" ||
        this.blocks[index].data.content.type === "server_tool_use") &&
      typeof (
        this.blocks[index].data.content as
          | BetaToolUseBlockParam
          | BetaServerToolUseBlockParam
      ).input === "object"
    ) {
      (
        this.blocks[index].data.content as
          | BetaToolUseBlockParam
          | BetaServerToolUseBlockParam
      ).input = "";
    }
  }

  /**
   * Parses the string available in the `input` field of a tool use block and replaces it with the parsed object.
   * Should be used when the input is a stringified JSON.
   *
   * @param index - The index of the block to convert.
   *
   * Only affects the block if it's a tool where the input is a string, otherwise it does nothing.
   */
  private convertToolUseBlockInputToObject(index: number) {
    if (
      (this.blocks[index].data.content.type === "tool_use" ||
        this.blocks[index].data.content.type === "server_tool_use") &&
      typeof (
        this.blocks[index].data.content as
          | BetaToolUseBlockParam
          | BetaServerToolUseBlockParam
      ).input === "string"
    ) {
      const inputString = (
        this.blocks[index].data.content as
          | BetaToolUseBlockParam
          | BetaServerToolUseBlockParam
      ).input as string;

      // Handle empty input strings (tools with no parameters)
      (
        this.blocks[index].data.content as
          | BetaToolUseBlockParam
          | BetaServerToolUseBlockParam
      ).input = inputString === "" ? {} : JSON.parse(inputString);
    }
  }

  processMessageStart(data: BetaRawMessageStartEvent) {
    for (const index in data.message.content) {
      this.processCompleteBlock(parseInt(index), data.message.content[index]);
    }

    if (data.message.container) this.setContainer(data.message.container);
    if (data.message.stop_reason) this.setStopReason(data.message.stop_reason);

    // Extract message ID and initial usage
    this.messageId = data.message.id;
    if (data.message.usage) {
      this.usageData = {
        inputTokens: data.message.usage.input_tokens,
        outputTokens: data.message.usage.output_tokens,
        cacheCreationInputTokens:
          data.message.usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: data.message.usage.cache_read_input_tokens ?? 0,
      };
    }
  }

  processMessageDelta(data: BetaRawMessageDeltaEvent) {
    if (data.delta.container) this.setContainer(data.delta.container);
    if (data.delta.stop_reason) this.setStopReason(data.delta.stop_reason);

    // Extract final usage (authoritative output_tokens value)
    if (data.usage) {
      this.usageData = {
        inputTokens: this.usageData?.inputTokens ?? 0,
        outputTokens: data.usage.output_tokens,
        cacheCreationInputTokens: this.usageData?.cacheCreationInputTokens ?? 0,
        cacheReadInputTokens: this.usageData?.cacheReadInputTokens ?? 0,
      };
    }

    // We aren't processing `stop_sequence` here as it should never occur
  }

  async processMessageStop() {
    this.turn.complete = true;
    this.turn.dirty = true;

    if (
      this.turn.metadata.stopReason === "end_turn" ||
      this.turn.metadata.stopReason === "max_tokens" ||
      this.turn.metadata.stopReason === "stop_sequence" ||
      this.turn.metadata.stopReason === "refusal"
    ) {
      this.task.status = "available";
    }

    this.task.dirty = true;

    // Record usage before flushing to DB
    if (this.messageId && this.usageData) {
      await this.usageService.recordUsage({
        organisationId: this.task.organisationId,
        taskId: this.task.id,
        messageId: this.messageId,
        model: this.model,
        inputTokens: this.usageData.inputTokens,
        outputTokens: this.usageData.outputTokens,
        cacheCreationInputTokens: this.usageData.cacheCreationInputTokens,
        cacheReadInputTokens: this.usageData.cacheReadInputTokens,
      });
    }

    await this.flushToDb();
  }

  processCompleteBlock(index: number, content: BetaContentBlockParam) {
    // Generate toolResponseTurn if this is a tool_use block
    if (content.type === "tool_use" && !this.toolResponseTurn) {
      this.toolResponseTurn = {
        id: randomUUID(),
        dirty: true,
      };
    }

    // Initialize block if it doesn't exist (complete blocks can come without streaming)
    if (!this.blocks[index]) {
      this.blocks[index] = {
        id: randomUUID(),
        dirty: true,
        data: {
          content: content,
          complete: true,
          processed: true,
          status: "none",
        },
      };
    } else {
      this.blocks[index].data.content = content;
      this.blocks[index].data.complete = true;
      this.blocks[index].data.processed = true;
      this.blocks[index].data.status = "none";
      this.blocks[index].dirty = true;
    }

    if (content.type === "tool_use") {
      const toolName = (content as BetaToolUseBlockParam).name;

      if (isServerTool(toolName)) {
        // Server tools are executed on the server via a queue
        this.blocks[index].data.status = "server_pending";
      } else if (this.toolToMcpId.has(toolName)) {
        // MCP tools are executed on the server via a separate queue
        this.blocks[index].data.status = "mcp_pending";
        this.blocks[index].data.metadata = {
          mcpId: this.toolToMcpId.get(toolName),
        };
      } else {
        // Permission checker goes here to check what's the status to be added to the block.
        this.blocks[index].data.status = "client_pending";
      }
    }
  }

  processBlockStart(data: BetaRawContentBlockStartEvent) {
    const content = data.content_block;

    // Generate toolResponseTurn if this is a tool_use block
    if (content.type === "tool_use" && !this.toolResponseTurn) {
      this.toolResponseTurn = {
        id: randomUUID(),
        dirty: true,
      };
    }

    // Add block to our internal state with generated ID
    this.blocks[data.index] = {
      id: randomUUID(),
      dirty: true,
      data: {
        content: content,
        complete: false,
        processed: false,
        status: "none",
      },
    };
  }

  processBlockDelta(data: BetaRawContentBlockDeltaEvent) {
    switch (data.delta.type) {
      case "text_delta": {
        (this.blocks[data.index].data.content as BetaTextBlockParam).text +=
          data.delta.text;
        this.blocks[data.index].dirty = true;
        break;
      }
      case "input_json_delta": {
        // When starting the block, the input is an empty object,
        // in order to process partial JSON we must convert it to a string.
        this.convertToolUseBlockInputToString(data.index);
        (
          this.blocks[data.index].data.content as
            | BetaToolUseBlockParam
            | BetaServerToolUseBlockParam
        ).input += data.delta.partial_json;
        this.blocks[data.index].dirty = true;
        break;
      }
      default: {
        break;
      }
    }
  }

  processBlockStop(data: BetaRawContentBlockStopEvent) {
    // Tool use blocks might have JSON that's accumulated in string format and needs to be parsed
    if (
      this.blocks[data.index].data.content.type === "tool_use" ||
      this.blocks[data.index].data.content.type === "server_tool_use"
    ) {
      this.convertToolUseBlockInputToObject(data.index);
    }

    if (this.blocks[data.index].data.content.type === "tool_use") {
      const toolName = (
        this.blocks[data.index].data.content as BetaToolUseBlockParam
      ).name;

      if (isServerTool(toolName)) {
        // Server tools are executed on the server via a queue
        this.blocks[data.index].data.status = "server_pending";
      } else if (this.toolToMcpId.has(toolName)) {
        // MCP tools are executed on the server via a separate queue
        this.blocks[data.index].data.status = "mcp_pending";
        this.blocks[data.index].data.metadata = {
          mcpId: this.toolToMcpId.get(toolName),
        };
      } else {
        // Permission checker goes here to check what's the status to be added to the block.
        this.blocks[data.index].data.status = "client_pending";
      }
    }

    this.blocks[data.index].data.complete = true;
    this.blocks[data.index].data.processed = true;
    this.blocks[data.index].dirty = true;
  }

  async flushToDb() {
    // Update task status
    if (this.task.dirty) {
      await this.db
        .update(tasks)
        .set({
          status: this.task.status,
          updated_at: new Date(),
        })
        .where(eq(tasks.id, this.task.id));
      this.task.dirty = false;
    }

    // Upsert assistant turn
    if (this.turn.dirty) {
      await this.db
        .insert(turns)
        .values({
          id: this.turn.id,
          type: "assistant",
          complete: this.turn.complete,
          metadata: this.turn.metadata,
          task_id: this.task.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflictDoUpdate({
          target: turns.id,
          set: {
            complete: this.turn.complete,
            metadata: this.turn.metadata,
            updated_at: new Date(),
          },
        });
      this.turn.dirty = false;
    }

    // Upsert tool response turn if needed
    if (this.toolResponseTurn?.dirty) {
      // Note: Sometimes assistant turns and their response turns are created at the same time,
      // so we need to wait a bit to ensure the response turn is created after the assistant turn
      // to ensure ordering. This is a temporary workaround until we have a better solution for ordering.
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.db
        .insert(turns)
        .values({
          id: this.toolResponseTurn.id,
          type: "user",
          task_id: this.task.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflictDoNothing();
      this.toolResponseTurn.dirty = false;
    }

    // Upsert blocks
    for (const block of Object.values(this.blocks)) {
      if (block.dirty) {
        await this.db
          .insert(blocks)
          .values({
            id: block.id,
            turn_id: this.turn.id,
            type: block.data.content
              .type as (typeof blockType.enumValues)[number],
            content: block.data.content,
            metadata: block.data.metadata,
            complete: block.data.complete,
            status: block.data.status,
            processed: block.data.processed,
            response_turn_id:
              block.data.content.type === "tool_use"
                ? this.toolResponseTurn?.id
                : null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .onConflictDoUpdate({
            target: blocks.id,
            set: {
              content: block.data.content,
              metadata: block.data.metadata,
              complete: block.data.complete,
              processed: block.data.processed,
              status: block.data.status,
              updated_at: new Date(),
            },
          });

        // Queue server tool execution if block is complete and status is server_pending
        if (
          block.data.content.type === "tool_use" &&
          block.data.complete &&
          block.data.status === "server_pending"
        ) {
          const toolName = (block.data.content as BetaToolUseBlockParam).name;
          const toolInput = (block.data.content as BetaToolUseBlockParam).input;

          await addToServerToolExecutorQueue({
            task_id: this.task.id,
            turn_id: this.toolResponseTurn!.id,
            block_id: block.id,
            tool_name: toolName,
            tool_input: toolInput,
          });
        }

        // Queue MCP tool execution if block is complete and status is mcp_pending
        if (
          block.data.content.type === "tool_use" &&
          block.data.complete &&
          block.data.status === "mcp_pending" &&
          block.data.metadata?.mcpId
        ) {
          const toolName = (block.data.content as BetaToolUseBlockParam).name;
          const toolInput = (block.data.content as BetaToolUseBlockParam).input;

          await addToMcpToolExecutorQueue({
            task_id: this.task.id,
            turn_id: this.toolResponseTurn!.id,
            block_id: block.id,
            tool_name: toolName,
            tool_input: toolInput,
            mcp_id: block.data.metadata.mcpId,
          });
        }

        block.dirty = false;
      }
    }
  }
}
