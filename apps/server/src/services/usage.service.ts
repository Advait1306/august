import { AppState } from "../config/state";
import { usage } from "@jupiter/sync/db/schema";

interface UsageData {
  organisationId: string;
  taskId: string;
  messageId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export class UsageService {
  private static instance: UsageService;

  private constructor(private db: AppState["db"]) {}

  public static getInstance(db: AppState["db"]): UsageService {
    if (!UsageService.instance) {
      UsageService.instance = new UsageService(db);
    }
    return UsageService.instance;
  }

  /**
   * Record usage for a message. Deduplicates using unique constraint on message_id.
   */
  async recordUsage(data: UsageData): Promise<void> {
    await this.db
      .insert(usage)
      .values({
        organisation_id: data.organisationId,
        task_id: data.taskId,
        message_id: data.messageId,
        model: data.model,
        input_tokens: data.inputTokens,
        output_tokens: data.outputTokens,
        cache_creation_input_tokens: data.cacheCreationInputTokens,
        cache_read_input_tokens: data.cacheReadInputTokens,
      })
      .onConflictDoNothing();
  }
}
