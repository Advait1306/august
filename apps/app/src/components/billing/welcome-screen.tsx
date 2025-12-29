import { OrganizationSwitcher, useAuth, UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function WelcomeScreen() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
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

      // Open checkout in external browser
      window.api?.browser.openUrl(data.checkoutUrl);
    } catch (error) {
      console.error("Error creating subscription checkout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <OrganizationSwitcher />
        <UserButton />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to August
          </h1>
          <p className="mt-4 text-muted-foreground">
            Start your 10-day free trial to unlock full access to August's AI
            assistant capabilities for your team.
          </p>

          <div className="mt-8 rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">
              Seat-based pricing
            </div>
            <div className="mt-2 text-2xl font-semibold">$35/seat/month</div>
            <div className="mt-1 text-sm text-muted-foreground">
              10-day free trial included
            </div>

            <Button
              className="mt-6 w-full"
              size="lg"
              onClick={handleSubscribe}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Start Free Trial"}
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            By subscribing, you agree to our terms of service and privacy
            policy.
          </p>
        </div>
      </main>
    </div>
  );
}
