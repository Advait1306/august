import type DodoPayments from "dodopayments";
import { AppState } from "../config/state";
import {
  SUBSCRIPTION_PRODUCT_ID,
  ADDON_SEAT_PRODUCT_ID,
} from "./subscription.service";

export interface CreateCheckoutSessionParams {
  userId: string;
  organisationId: string;
  returnUrl: string;
  memberCount: number;
  customerName?: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string;
}

export class BillingService {
  private static instance: BillingService;

  private constructor(
    private db: AppState["db"],
    private dodoClient: DodoPayments
  ) {}

  static getInstance(
    db: AppState["db"],
    dodoClient: DodoPayments
  ): BillingService {
    if (!BillingService.instance) {
      BillingService.instance = new BillingService(db, dodoClient);
    }
    return BillingService.instance;
  }

  /**
   * Calculate addon seat quantity based on member count
   * Base subscription includes 1 seat, so addons = memberCount - 1
   */
  private calculateAddonSeats(memberCount: number): number {
    return Math.max(0, memberCount - 1);
  }

  /**
   * Create a checkout session for a subscription
   * Used for new subscriptions and resubscribing lapsed orgs
   */
  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<CheckoutSessionResult> {
    const { userId, organisationId, returnUrl, memberCount, customerName } = params;

    const addonSeats = this.calculateAddonSeats(memberCount);

    // Generate customer email as a unique id
    const customerEmail = `${organisationId}@customer.august.tech`;

    // Build addons array if needed
    const addons =
      addonSeats > 0
        ? [{ addon_id: ADDON_SEAT_PRODUCT_ID, quantity: addonSeats }]
        : undefined;

    // Create checkout session for subscription product
    // Note: Trial period is configured on the product in Dodo dashboard
    const checkoutResponse = await this.dodoClient.checkoutSessions.create({
      product_cart: [
        {
          product_id: SUBSCRIPTION_PRODUCT_ID,
          quantity: 1,
          addons,
        },
      ],
      customer: {
        name: customerName ?? "",
        email: customerEmail,
      },
      return_url: returnUrl,
      metadata: {
        organisation_id: organisationId,
      },
    });

    return {
      checkoutUrl: checkoutResponse.checkout_url,
      sessionId: checkoutResponse.session_id,
    };
  }
}
