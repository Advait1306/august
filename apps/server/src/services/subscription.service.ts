import { eq } from "drizzle-orm";
import type DodoPayments from "dodopayments";
import type { ClerkClient } from "@clerk/express";
import { organisations } from "@jupiter/sync/db/schema";
import { AppState } from "../config/state";

// Product IDs for different environments
const SUBSCRIPTION_PRODUCT_ID_TEST = "pdt_0NV3MBvQ4Cc8uEZiilx3Q";
const ADDON_SEAT_PRODUCT_ID_TEST = "adn_0NV3Mw8K54WjM5ARADSDs";

// TODO: Add production IDs when available
const SUBSCRIPTION_PRODUCT_ID_PROD = "pdt_0NV3MBvQ4Cc8uEZiilx3Q";
const ADDON_SEAT_PRODUCT_ID_PROD = "adn_0NV3Mw8K54WjM5ARADSDs";

export const SUBSCRIPTION_PRODUCT_ID =
  process.env.NODE_ENV === "production"
    ? SUBSCRIPTION_PRODUCT_ID_PROD
    : SUBSCRIPTION_PRODUCT_ID_TEST;

export const ADDON_SEAT_PRODUCT_ID =
  process.env.NODE_ENV === "production"
    ? ADDON_SEAT_PRODUCT_ID_PROD
    : ADDON_SEAT_PRODUCT_ID_TEST;

// Trial period in days
export const TRIAL_PERIOD_DAYS = 10;

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "on_hold"
  | "cancelled"
  | "failed"
  | "expired";

export class SubscriptionService {
  constructor(
    private db: AppState["db"],
    private dodoClient: DodoPayments,
    private clerkClient: ClerkClient
  ) {}

  /**
   * Generate a customer email for Dodo Payments
   * Format: {org_id}@customer.august.tech
   */
  private getCustomerEmail(orgId: string): string {
    return `${orgId}@customer.august.tech`;
  }

  /**
   * Get the number of members in an organization from Clerk
   */
  async getOrgMemberCount(orgId: string): Promise<number> {
    try {
      const memberships =
        await this.clerkClient.organizations.getOrganizationMembershipList({
          organizationId: orgId,
        });
      return memberships.totalCount;
    } catch (error) {
      console.error(`Failed to get member count for org ${orgId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate addon seat quantity based on member count
   * Base subscription includes 1 seat, so addons = memberCount - 1
   */
  calculateAddonSeats(memberCount: number): number {
    return Math.max(0, memberCount - 1);
  }

  /**
   * Update the subscription status for an organisation
   */
  async updateSubscriptionStatus(
    orgId: string,
    status: SubscriptionStatus,
    subscriptionId?: string
  ): Promise<void> {
    const updateData: Partial<typeof organisations.$inferInsert> = {
      subscription_status: status,
    };

    if (subscriptionId) {
      updateData.subscription_id = subscriptionId;
    }

    await this.db
      .update(organisations)
      .set(updateData)
      .where(eq(organisations.id, orgId));
  }

  /**
   * Get subscription details by ID
   */
  async getSubscription(subscriptionId: string) {
    try {
      return await this.dodoClient.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error(`Failed to retrieve subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Update subscription addon seats when members change
   * Uses prorated_immediately for immediate billing adjustment
   */
  async updateSubscriptionSeats(
    subscriptionId: string,
    newAddonQuantity: number
  ): Promise<void> {
    try {
      // Get current subscription to get the product_id and quantity
      const subscription = await this.getSubscription(subscriptionId);

      // Build addons array - empty if no addon seats needed
      const addons =
        newAddonQuantity > 0
          ? [{ addon_id: ADDON_SEAT_PRODUCT_ID, quantity: newAddonQuantity }]
          : [];

      // Use changePlan to update addons with proration
      await this.dodoClient.subscriptions.changePlan(subscriptionId, {
        product_id: subscription.product_id,
        quantity: subscription.quantity,
        proration_billing_mode: "prorated_immediately",
        addons,
      });

      console.log(
        `Updated subscription ${subscriptionId} addon seats to ${newAddonQuantity}`
      );
    } catch (error) {
      console.error(
        `Failed to update subscription seats for ${subscriptionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Handle member change in organisation (add/remove)
   * Updates addon seat count if org has a subscription
   * @param orgId - Organization ID
   * @param memberCount - Optional member count from webhook payload (preferred)
   */
  async handleMemberChange(orgId: string, memberCount?: number): Promise<void> {
    try {
      // Get org to check if it has a subscription
      const org = await this.db
        .select()
        .from(organisations)
        .where(eq(organisations.id, orgId))
        .limit(1);

      if (!org || org.length === 0) {
        console.log(`Org ${orgId} not found, skipping member change handler`);
        return;
      }

      const { subscription_id } = org[0];

      // Only update if org has a subscription (regardless of status)
      if (!subscription_id) {
        console.log(`Org ${orgId} has no subscription, skipping seat update`);
        return;
      }

      // Use provided member count or fall back to API call
      const actualMemberCount =
        memberCount ?? (await this.getOrgMemberCount(orgId));
      const addonSeats = this.calculateAddonSeats(actualMemberCount);

      console.log(
        `Org ${orgId} member change: ${actualMemberCount} members, ${addonSeats} addon seats`
      );

      await this.updateSubscriptionSeats(subscription_id, addonSeats);
    } catch (error) {
      console.error(`Failed to handle member change for org ${orgId}:`, error);
      // Don't throw - we don't want to fail the webhook
    }
  }
}
