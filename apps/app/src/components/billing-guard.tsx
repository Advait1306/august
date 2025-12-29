import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@jupiter/sync/queries/data";
import { subscriptionStatus } from "@jupiter/sync/db/schema";
import { WelcomeScreen } from "./billing/welcome-screen";
import { ResubscribeScreen } from "./billing/resubscribe-screen";

type SubscriptionStatus = (typeof subscriptionStatus.enumValues)[number] | null;

// Statuses that allow full access
const ALLOWED_STATUSES: SubscriptionStatus[] = ["active", "pending", "on_hold"];

// Statuses that require resubscribing
const BLOCKED_STATUSES: SubscriptionStatus[] = [
  "cancelled",
  "failed",
  "expired",
];

interface BillingGuardProps {
  children: React.ReactNode;
}

export function BillingGuard({ children }: BillingGuardProps) {
  const [organisation, result] = useQuery(queries.organisations.current());
  const isComplete = result.type === "complete";

  // Wait for organisation data to load
  if (organisation === undefined) {
    return null;
  }

  const { billing_exempt, subscription_status } = organisation ?? {};

  // Billing exempt orgs have full access
  // Allowed statuses have full access (can show before result is complete)
  if (
    billing_exempt ||
    (subscription_status && ALLOWED_STATUSES.includes(subscription_status))
  ) {
    return <>{children}</>;
  }

  // For billing screens, wait for result to be complete to avoid flashing
  if (!isComplete) {
    return null;
  }

  // Blocked statuses show resubscribe screen
  if (subscription_status && BLOCKED_STATUSES.includes(subscription_status)) {
    return <ResubscribeScreen />;
  }

  // If org doesn't exist (new org not synced), show welcome
  // No subscription - show welcome screen
  return <WelcomeScreen />;
}
