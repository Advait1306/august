import { useState, useCallback } from "react";
import { CreditCard, Loader2, ExternalLink } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useZero } from "@/src/hooks/useZero";
import { queries } from "@jupiter/sync/queries/data";
import { mutators } from "@jupiter/sync/mutators/data";

const PORTAL_LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function BillingButton() {
  const z = useZero();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setIsLoading(true);

    try {
      // Query current portal data
      let portalData = await z.run(queries.dodoCustomerPortal.current());

      // Check if we have a valid cached link
      const isLinkValid =
        portalData?.link &&
        portalData.created_at &&
        Date.now() - portalData.created_at < PORTAL_LINK_TTL_MS;

      if (!isLinkValid) {
        // Need to refresh the link
        await z.mutate(mutators.dodoCustomerPortal.createLink()).server;

        // Query again to get the new link
        portalData = await z.run(queries.dodoCustomerPortal.current());
      }

      if (portalData?.link) {
        window.api.browser.openUrl(portalData.link);
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
    } finally {
      setIsLoading(false);
    }
  }, [z]);

  return (
    <SidebarMenuButton
      tooltip="Billing"
      onClick={handleClick}
      disabled={isLoading}
    >
      <CreditCard />
      <span className="flex-1">Billing</span>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ExternalLink className="h-4 w-4" />
      )}
    </SidebarMenuButton>
  );
}
