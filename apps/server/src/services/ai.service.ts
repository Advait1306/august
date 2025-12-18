import { eq } from "drizzle-orm";
import { AppState } from "../config/state";
import { tasks } from "@jupiter/sync/db/schema";

export class AiService {
  private static instance: AiService;
  private constructor(private db: AppState["db"]) {}

  public static getInstance(state: AppState) {
    if (!AiService.instance) {
      AiService.instance = new AiService(state.db);
    }
    return AiService.instance;
  }

  async runAgentLoop(taskId: string, turnId: string, blockId: string) {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        turns: {
          with: {
            blocks: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    const turn = task.turns.find((turn) => turn.id === turnId);
    if (!turn) {
      throw new Error("Turn not found");
    }

    const block = turn.blocks.find((block) => block.id === blockId);
    if (!block) {
      throw new Error("Block not found");
    }

    // TODO: Do agent loop kickstarting checks here
    // TODO: Implement agent loop here
  }
}
