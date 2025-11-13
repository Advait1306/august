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

export class BillingService {
  constructor(private db: NodePgDatabase) {}

  /**
   * Calculate cost for Claude models
   */
  private calculateClaudeCost(model: string, usageData: UsageData): number {
    const inputTokens = usageData.input_tokens || 0;
    const outputTokens = usageData.output_tokens || 0;
    const cacheWriteTokens = usageData.cache_creation_input_tokens || 0;
    const cacheReadTokens = usageData.cache_read_input_tokens || 0;

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

  /**
   * Check if an organisation has sufficient wallet balance
   */
  async checkWalletBalance(orgId: string): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
  }> {
    try {
      const org = await this.db
        .select()
        .from(organisations)
        .where(eq(organisations.id, orgId))
        .limit(1);

      if (!org || org.length === 0) {
        return { success: false, error: "Organisation not found" };
      }

      if (org[0].wallet < 0) {
        return {
          success: false,
          balance: org[0].wallet,
          error: "Insufficient balance. Please add credits to continue.",
        };
      }

      return { success: true, balance: org[0].wallet };
    } catch (error) {
      console.error("Failed to check wallet balance:", error);
      return { success: false, error: "Failed to check wallet balance" };
    }
  }

  /**
   * Deduct usage cost from organisation wallet
   */
  async deductUsage(orgId: string, model: string, usageData: UsageData) {
    const costInCents = this.calculateClaudeCost(model, usageData);

    if (costInCents > 0) {
      try {
        // Insert usage record
        await this.db.insert(usage).values({
          organisation_id: orgId,
          model,
          input_tokens: usageData.input_tokens || 0,
          output_tokens: usageData.output_tokens || 0,
          cache_creation_input_tokens:
            usageData.cache_creation_input_tokens || 0,
          cache_read_input_tokens: usageData.cache_read_input_tokens || 0,
          cost: costInCents,
        });

        // Deduct cost from organisation wallet (wallet stores cents)
        await this.db
          .update(organisations)
          .set({
            wallet: sql`${organisations.wallet} - ${costInCents}`,
          })
          .where(eq(organisations.id, orgId));

        console.log(
          `Deducted ${costInCents.toFixed(4)}¢ from org ${orgId} wallet (${model})`
        );
      } catch (error) {
        console.error("Failed to deduct usage cost:", error);
      }
    }
  }

  /**
   * Add credits to organisation wallet
   */
  async addCredits(orgId: string, amountInCents: number): Promise<{
    success: boolean;
    newBalance?: number;
    error?: string;
  }> {
    try {
      // Verify organisation exists
      const org = await this.db
        .select()
        .from(organisations)
        .where(eq(organisations.id, orgId))
        .limit(1);

      if (!org || org.length === 0) {
        return { success: false, error: "Organisation not found" };
      }

      // Add credits to wallet
      await this.db
        .update(organisations)
        .set({
          wallet: sql`${organisations.wallet} + ${amountInCents}`,
        })
        .where(eq(organisations.id, orgId));

      // Fetch updated balance
      const updatedOrg = await this.db
        .select()
        .from(organisations)
        .where(eq(organisations.id, orgId))
        .limit(1);

      const newBalance = updatedOrg[0]?.wallet ?? 0;

      console.log(
        `Added ${amountInCents}¢ to org ${orgId} wallet. New balance: ${newBalance}¢`
      );

      return { success: true, newBalance };
    } catch (error) {
      console.error("Failed to add credits:", error);
      return { success: false, error: "Failed to add credits" };
    }
  }
}
