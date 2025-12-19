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
import { blocks, blockType, turns } from "@jupiter/sync/db/schema";
import { eq } from "drizzle-orm";

export class AssistantTurnProcessor {
  private db: AppState["db"];
  private taskId: string;

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
      };
    }
  > = {};

  constructor(db: AppState["db"], taskId: string) {
    this.db = db;
    this.taskId = taskId;
  }

  setContainer(container: BetaContainer) {
    this.turn.metadata.container = container;
    this.turn.dirty = true;
  }

  setStopReason(stopReason: BetaStopReason) {
    this.turn.metadata.stopReason = stopReason;
    this.turn.dirty = true;
  }

  processMessageStart(data: BetaRawMessageStartEvent) {
    for (const index in data.message.content) {
      this.processBlockStart({
        index: parseInt(index),
        content_block: data.message.content[index],
        type: "content_block_start",
      });
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
    this.flushToDb();
  }

  processBlockStart(data: BetaRawContentBlockStartEvent) {
    const content = data.content_block;

    // Add block to our internal state
    this.blocks[data.index] = {
      dirty: true,
      data: {
        content: content,
        complete: false,
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
    this.blocks[data.index].data.complete = true;
    this.blocks[data.index].dirty = true;

    // TODO: Add check for tools that can be executed on August servers
  }

  async flushToDb() {
    if (!this.turn.id) {
      const turnId = crypto.randomUUID();
      await this.db.insert(turns).values({
        id: turnId,
        type: "assistant",
        complete: this.turn.complete,
        metadata: this.turn.metadata,
        task_id: this.taskId,
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
    }

    if (this.toolResponseTurnRequired && !this.toolResponseTurnId) {
      const toolResponseTurnId = crypto.randomUUID();
      await this.db.insert(turns).values({
        id: toolResponseTurnId,
        type: "user",
        task_id: this.taskId,
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
            updated_at: new Date(),
          })
          .where(eq(blocks.id, block.id));
      }
    }
  }
}
