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
import { blocks, blockType, tasks, turns } from "@jupiter/sync/db/schema";
import { eq } from "drizzle-orm";

export class AssistantTurnProcessor {
  private db: AppState["db"];

  private task: {
    id?: string;
    status: "available" | "executing" | "starting";
    dirty: boolean;
  } = {
    status: "starting",
    dirty: false,
  };

  // Internal state
  private turn: {
    id?: string;
    metadata: {
      container?: BetaContainer;
      stopReason?: BetaStopReason;
    };
    complete: boolean;
    dirty: boolean;
  } = {
    metadata: {},
    complete: false,
    dirty: true,
  };

  private toolResponseTurnRequired = false;
  private toolResponseTurnId?: string;

  private blocks: Record<
    number,
    {
      id?: string;
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
          | "completed";
      };
    }
  > = {};

  constructor(db: AppState["db"], taskId: string) {
    this.db = db;
    this.task.id = taskId;
    this.task.status = "executing";
    this.task.dirty = true;
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
      (
        this.blocks[index].data.content as
          | BetaToolUseBlockParam
          | BetaServerToolUseBlockParam
      ).input = JSON.parse(
        (
          this.blocks[index].data.content as
            | BetaToolUseBlockParam
            | BetaServerToolUseBlockParam
        ).input as string
      );
    }
  }

  processMessageStart(data: BetaRawMessageStartEvent) {
    for (const index in data.message.content) {
      this.processCompleteBlock(parseInt(index), data.message.content[index]);
    }

    if (data.message.container) this.setContainer(data.message.container);
    if (data.message.stop_reason) this.setStopReason(data.message.stop_reason);
  }

  processMessageDelta(data: BetaRawMessageDeltaEvent) {
    if (data.delta.container) this.setContainer(data.delta.container);
    if (data.delta.stop_reason) this.setStopReason(data.delta.stop_reason);

    // We aren't processing `stop_sequence` here as it should never occur
  }

  processMessageStop() {
    this.turn.complete = true;
    this.turn.dirty = true;
    this.task.status = "available";
    this.task.dirty = true;
    this.flushToDb();
  }

  processCompleteBlock(index: number, content: BetaContentBlockParam) {
    this.blocks[index].data.content = content;
    this.blocks[index].data.complete = true;
    this.blocks[index].data.processed = true;
    this.blocks[index].data.status = "none";

    if (content.type === "tool_use") {
      this.toolResponseTurnRequired = true;
    }

    if (this.blocks[index].data.content.type === "tool_use") {
      // Permission checker goes here to check what's the status to be added to the block.
      this.blocks[index].data.status = "client_pending";
    }

    this.blocks[index].dirty = true;
  }

  processBlockStart(data: BetaRawContentBlockStartEvent) {
    const content = data.content_block;

    // Add block to our internal state
    this.blocks[data.index] = {
      dirty: true,
      data: {
        content: content,
        complete: false,
        processed: false,
        status: "none",
      },
    };

    if (content.type === "tool_use") {
      this.toolResponseTurnRequired = true;
    }
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
      // Permission checker goes here to check what's the status to be added to the block.
      this.blocks[data.index].data.status = "client_pending";
    }

    this.blocks[data.index].data.complete = true;
    this.blocks[data.index].data.processed = true;
    this.blocks[data.index].dirty = true;

    // TODO: Add check for tools that can be executed on August servers
  }

  async flushToDb() {
    if (this.task.dirty) {
      await this.db
        .update(tasks)
        .set({
          status: this.task.status,
          updated_at: new Date(),
        })
        .where(eq(tasks.id, this.task.id!));
      this.task.dirty = false;
    }

    if (!this.turn.id) {
      const turnId = crypto.randomUUID();
      await this.db.insert(turns).values({
        id: turnId,
        type: "assistant",
        complete: this.turn.complete,
        metadata: this.turn.metadata,
        task_id: this.task.id!,
        created_at: new Date(),
        updated_at: new Date(),
      });
      this.turn.id = turnId;
      this.turn.dirty = false;
    }

    if (this.turn.dirty && this.turn.id) {
      await this.db
        .update(turns)
        .set({
          complete: this.turn.complete,
          metadata: this.turn.metadata,
          updated_at: new Date(),
        })
        .where(eq(turns.id, this.turn.id));

      this.turn.dirty = false;
    }

    if (this.toolResponseTurnRequired && !this.toolResponseTurnId) {
      const toolResponseTurnId = crypto.randomUUID();
      await this.db.insert(turns).values({
        id: toolResponseTurnId,
        type: "user",
        task_id: this.task.id!,
        created_at: new Date(),
        updated_at: new Date(),
      });
      this.toolResponseTurnId = toolResponseTurnId;
    }

    for (const block of Object.values(this.blocks)) {
      // Block isn't made yet create and add initial values
      if (!block.id) {
        const blockId = crypto.randomUUID();
        await this.db.insert(blocks).values({
          id: blockId,
          turn_id: this.turn.id,
          // TODO: Fix types here
          type: block.data.content
            .type as (typeof blockType.enumValues)[number],
          content: block.data.content,
          created_at: new Date(),
          updated_at: new Date(),
          complete: block.data.complete,
          status: block.data.status,
          processed: block.data.processed,
          // Tool use types require a response turn for clients to put result in
          response_turn_id:
            block.data.content.type === "tool_use"
              ? this.toolResponseTurnId
              : undefined,
        });
        block.id = blockId;
        block.dirty = false;
      }

      if (block.dirty && block.id) {
        await this.db
          .update(blocks)
          .set({
            content: block.data.content,
            complete: block.data.complete,
            processed: block.data.processed,
            status: block.data.status,
            updated_at: new Date(),
          })
          .where(eq(blocks.id, block.id));

        block.dirty = false;
      }
    }
  }
}
