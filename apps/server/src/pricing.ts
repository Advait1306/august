import { eq, sql } from "drizzle-orm";
import { organisations, usage } from "@jupiter/sync/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

// Pricing calculation for Claude models (prices in cents per 1M tokens)
export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export function calculateClaudeCost(model: string, usage: UsageData): number {
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;

  const totalInputTokens = inputTokens + cacheWriteTokens + cacheReadTokens;
  const isExtendedContext = totalInputTokens > 200000;

  let costInCents = 0;

  if (model.includes("sonnet")) {
    // Sonnet 4.5 pricing (in cents)
    if (isExtendedContext) {
      // > 200K tokens
      costInCents += (inputTokens / 1_000_000) * 600; // Input: $6.00/1M = 600¢/1M
      costInCents += (outputTokens / 1_000_000) * 2250; // Output: $22.50/1M = 2250¢/1M
      costInCents += (cacheWriteTokens / 1_000_000) * 750; // Cache write: $7.50/1M = 750¢/1M
      costInCents += (cacheReadTokens / 1_000_000) * 60; // Cache read: $0.60/1M = 60¢/1M
    } else {
      // < 200K tokens
      costInCents += (inputTokens / 1_000_000) * 300; // Input: $3.00/1M = 300¢/1M
      costInCents += (outputTokens / 1_000_000) * 1500; // Output: $15.00/1M = 1500¢/1M
      costInCents += (cacheWriteTokens / 1_000_000) * 375; // Cache write: $3.75/1M = 375¢/1M
      costInCents += (cacheReadTokens / 1_000_000) * 30; // Cache read: $0.30/1M = 30¢/1M
    }
  } else if (model.includes("haiku")) {
    // Haiku 4.5 pricing (in cents, no extended context pricing)
    costInCents += (inputTokens / 1_000_000) * 100; // Input: $1.00/1M = 100¢/1M
    costInCents += (outputTokens / 1_000_000) * 500; // Output: $5.00/1M = 500¢/1M
    costInCents += (cacheWriteTokens / 1_000_000) * 125; // Cache write: $1.25/1M = 125¢/1M
    costInCents += (cacheReadTokens / 1_000_000) * 10; // Cache read: $0.10/1M = 10¢/1M
  } else {
    console.error(`Unknown model: ${model}`);
    return 0;
  }

  return costInCents;
}

export async function deductUsageCost(
  db: NodePgDatabase,
  orgId: string,
  model: string,
  usageData: UsageData
) {
  const costInCents = calculateClaudeCost(model, usageData);

  if (costInCents > 0) {
    try {
      // Insert usage record
      await db.insert(usage).values({
        organisation_id: orgId,
        model,
        input_tokens: usageData.input_tokens || 0,
        output_tokens: usageData.output_tokens || 0,
        cache_creation_input_tokens: usageData.cache_creation_input_tokens || 0,
        cache_read_input_tokens: usageData.cache_read_input_tokens || 0,
        cost: costInCents,
      });

      // Deduct cost from organisation wallet (wallet stores cents)
      await db
        .update(organisations)
        .set({
          wallet: sql`${organisations.wallet} - ${costInCents}`,
        })
        .where(eq(organisations.id, orgId));

      console.log(
        `Deducted ${costInCents.toFixed(4)}¢ ($${(costInCents / 100).toFixed(4)}) from org ${orgId} wallet (${model})`
      );
    } catch (error) {
      console.error("Failed to deduct usage cost:", error);
    }
  }
}
