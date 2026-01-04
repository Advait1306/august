import { eq } from "drizzle-orm";
import { Webhook } from "standardwebhooks";
import { organisations } from "@jupiter/sync/db/schema";
import { AppState } from "../config/state";
import {
  SubscriptionService,
  SubscriptionStatus,
} from "./subscription.service";

export interface WebhookEvent {
  type: string;
  data: {
    metadata?: {
      organisation_id?: string;
    };
    subscription_id?: string;
    status?: SubscriptionStatus;
    customer?: {
      customer_id?: string;
      email?: string;
    };
  };
}

export interface WebhookHeaders {
  webhookId: string;
  webhookSignature: string;
  webhookTimestamp: string;
}

export class DodoWebhookService {
  private static instance: DodoWebhookService;

  private constructor(private db: AppState["db"]) {}

  static getInstance(db: AppState["db"]): DodoWebhookService {
    if (!DodoWebhookService.instance) {
      DodoWebhookService.instance = new DodoWebhookService(db);
    }
    return DodoWebhookService.instance;
  }

  /**
   * Verify webhook signature and parse the payload
   * @throws Error if webhook secret is not configured or signature is invalid
   */
  async verifyAndParseWebhook(
    payload: string,
    headers: WebhookHeaders
  ): Promise<WebhookEvent> {
    const webhookSecret = process.env.DODO_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("DODO_WEBHOOK_SECRET not configured");
    }

    const webhook = new Webhook(webhookSecret);

    const formattedHeaders = {
      "webhook-id": headers.webhookId,
      "webhook-signature": headers.webhookSignature,
      "webhook-timestamp": headers.webhookTimestamp,
    };

    try {
      const event = webhook.verify(payload, formattedHeaders) as WebhookEvent;
      return event;
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      throw new Error("Invalid signature");
    }
  }

  /**
   * Resolve organisation ID from metadata or by looking up the subscription in the database
   */
  async resolveOrganisationId(
    subscriptionId: string,
    metadata?: { organisation_id?: string }
  ): Promise<string | null> {
    // First try to get from metadata
    const orgId =
      metadata && typeof metadata === "object"
        ? (metadata as Record<string, string>)?.organisation_id
        : undefined;

    if (orgId) {
      return orgId;
    }

    // Fallback: look up org by subscription_id
    const org = await this.db
      .select()
      .from(organisations)
      .where(eq(organisations.subscription_id, subscriptionId))
      .limit(1);

    if (org.length > 0) {
      return org[0].id;
    }

    return null;
  }

  /**
   * Handle webhook event by delegating to the subscription service
   */
  async handleWebhookEvent(
    event: WebhookEvent,
    subscriptionService: SubscriptionService
  ): Promise<void> {
    // Only handle subscription events
    if (!event.type.startsWith("subscription.")) {
      console.log(`Received webhook event: ${event.type}`);
      return;
    }

    const { subscription_id, metadata } = event.data;

    if (!subscription_id) {
      throw new Error("Missing subscription_id in webhook payload");
    }

    const orgId = await this.resolveOrganisationId(subscription_id, metadata);

    if (!orgId) {
      throw new Error(
        "Could not determine org ID from metadata or subscription lookup"
      );
    }

    try {
      switch (event.type) {
        case "subscription.active": {
          await subscriptionService.updateSubscriptionStatus(
            orgId,
            "active",
            subscription_id
          );
          break;
        }
        case "subscription.on_hold": {
          await subscriptionService.updateSubscriptionStatus(orgId, "on_hold");
          break;
        }
        case "subscription.failed": {
          await subscriptionService.updateSubscriptionStatus(orgId, "failed");
          break;
        }
        case "subscription.cancelled": {
          await subscriptionService.updateSubscriptionStatus(
            orgId,
            "cancelled"
          );
          break;
        }
        case "subscription.renewed": {
          await subscriptionService.updateSubscriptionStatus(orgId, "active");
          break;
        }
        case "subscription.expired": {
          await subscriptionService.updateSubscriptionStatus(orgId, "expired");
          break;
        }
      }
    } catch (error) {
      console.error(`Error processing subscription event ${event.type}:`, error);
      throw new Error(`Failed to process subscription event: ${event.type}`);
    }
  }
}
