import { OrganizationSwitcher, useAuth, UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { CheckoutModal } from "./checkout-modal";

export function ResubscribeScreen() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const handleResubscribe = async () => {
    setIsLoading(true);

    try {
      const token = await getToken();
      const returnUrl = window.location.origin;

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/subscription/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ returnUrl }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await response.json();
      setCheckoutUrl(data.checkoutUrl);
    } catch (error) {
      console.error("Error creating subscription checkout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <OrganizationSwitcher />
          <UserButton />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Subscription Inactive
            </h1>
            <p className="mt-4 text-muted-foreground">
              Your subscription has expired or been cancelled. Resubscribe to
              restore access to August for your team.
            </p>

            <div className="mt-8 rounded-lg border bg-card p-6">
              <div className="text-sm text-muted-foreground">
                Seat-based pricing
              </div>
              <div className="mt-2 text-2xl font-semibold">$35/seat/month</div>

              <Button
                className="mt-6 w-full"
                size="lg"
                onClick={handleResubscribe}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Resubscribe Now"}
              </Button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Need help? Contact support at support@august.tech
            </p>
          </div>
        </main>
      </div>

      {checkoutUrl && (
        <CheckoutModal url={checkoutUrl} onClose={() => setCheckoutUrl(null)} />
      )}
    </>
  );
}
