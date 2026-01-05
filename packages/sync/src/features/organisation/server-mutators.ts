import { defineMutator } from "@rocicorp/zero";
import type DodoPayments from "dodopayments";
import { builder } from "../../zero/schema";

// 24 hours in milliseconds
const PORTAL_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export function createOrganisationServerMutators(dodoClient: DodoPayments) {
  return {
    dodoCustomerPortal: {
      /**
       * Create/refresh the customer portal link.
       * Checks if cached link is still valid (< 24 hours old).
       * If expired or missing, creates a new portal session via Dodo API and caches it.
       */
      createLink: defineMutator(async ({ tx, ctx }) => {
        const organisationId = ctx.orgId;

        // Check if we have a cached link that's still valid
        const cached = await tx.run(
          builder.dodoCustomerPortal
            .where("organisation_id", organisationId)
            .one()
        );

        if (cached) {
          const createdAt = cached.created_at;
          if (createdAt) {
            const now = Date.now();
            const age = now - createdAt;

            // If link is less than 24 hours old, no refresh needed
            if (age < PORTAL_LINK_TTL_MS) {
              return;
            }
          }
        }

        // Look up customer by email reconstructed from org_id
        const customerEmail =
          `${organisationId}@customer.august.tech`.toLowerCase();

        const customers = await dodoClient.customers.list({
          email: customerEmail,
        });

        const customer = customers.items[0];
        if (!customer) {
          // No customer found - org hasn't gone through checkout yet
          return;
        }

        const customerId = customer.customer_id;

        // Create a new portal session
        const session =
          await dodoClient.customers.customerPortal.create(customerId);

        // Cache the new link (upsert)
        if (cached) {
          await tx.mutate.dodoCustomerPortal.update({
            organisation_id: organisationId,
            link: session.link,
            created_at: Date.now(),
          });
        } else {
          await tx.mutate.dodoCustomerPortal.insert({
            organisation_id: organisationId,
            link: session.link,
            created_at: Date.now(),
          });
        }
      }),
    },
  };
}
