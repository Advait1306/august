import { OrganizationSwitcher, useAuth, UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CheckoutModal } from "./checkout-modal";
import { Zap, Users, MessageCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Zap,
    title: "Unlimited AI Usage",
    description:
      "No caps, no throttling. Use August's AI assistant as much as you need without worrying about limits.",
  },
  {
    icon: Users,
    title: "Share AI Skills Across Your Team",
    description:
      "Build custom AI workflows once and share them instantly with everyone on your team.",
  },
  {
    icon: MessageCircle,
    title: "Direct Support from Founder",
    description:
      "Get personalized help straight from the founder. No support tiers, no waiting in queues.",
  },
];

export function WelcomeScreen() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

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
      setCheckoutUrl(data.checkoutUrl);
    } catch (error) {
      console.error("Error creating subscription checkout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="flex w-full max-w-lg flex-col gap-3">
          {/* Top Bar */}
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border border-card-border bg-card px-4 py-3 shadow-sm",
              "animate-in fade-in slide-in-from-bottom-2 duration-500"
            )}
          >
            {/* User Account Info */}

            <OrganizationSwitcher
              hidePersonal
              appearance={{
                elements: {
                  rootBox: "flex items-center",
                  organizationSwitcherTrigger:
                    "text-sm text-muted-foreground hover:text-foreground transition-colors",
                },
              }}
            />
            <UserButton />
          </div>

          {/* Main Card */}
          <div
            className={cn(
              "overflow-hidden rounded-xl border border-card-border bg-card shadow-md",
              "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both",
              "delay-100"
            )}
          >
            {/* Header Section */}
            <div className="border-b border-card-border px-6 py-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
                Welcome to August
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                Start your 10-day free trial to unlock full access to August's
                AI assistant capabilities for your team.
              </p>
            </div>

            {/* Features Section */}
            <div className="space-y-1 p-2">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={cn(
                    "group flex items-start gap-4 rounded-lg p-4 transition-all duration-200",
                    "hover:bg-accent/50",
                    "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                  )}
                  style={{
                    animationDelay: `${200 + index * 100}ms`,
                  }}
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      "bg-primary/10 text-primary transition-colors duration-200",
                      "group-hover:bg-primary/15"
                    )}
                  >
                    <feature.icon className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium text-card-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing Section */}
            <div
              className={cn(
                "border-t border-card-border bg-muted/30 px-6 py-6",
                "animate-in fade-in duration-500 fill-mode-both delay-500"
              )}
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Seat-based pricing
                </span>
                <span className="mt-2 text-3xl font-bold text-card-foreground">
                  $35
                  <span className="text-lg font-normal text-muted-foreground">
                    /seat/month
                  </span>
                </span>
                <span className="mt-1 text-sm text-muted-foreground">
                  10-day free trial included
                </span>

                <Button
                  className={cn(
                    "mt-5 w-full transition-all duration-200",
                    "hover:shadow-md hover:-translate-y-0.5"
                  )}
                  size="lg"
                  onClick={handleSubscribe}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    "Loading..."
                  ) : (
                    <>
                      Start Free Trial
                      <ArrowRight className="ml-1 size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {checkoutUrl && (
        <CheckoutModal url={checkoutUrl} onClose={() => setCheckoutUrl(null)} />
      )}
    </>
  );
}
