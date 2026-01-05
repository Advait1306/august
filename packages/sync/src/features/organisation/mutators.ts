import { defineMutator } from "@rocicorp/zero";

export const dodoCustomerPortalMutators = {
  /**
   * Create/refresh the customer portal link.
   * Client-side stub - actual implementation is on the server.
   */
  createLink: defineMutator(async () => {
    // No-op on client - server handles the Dodo API call
  }),
};
