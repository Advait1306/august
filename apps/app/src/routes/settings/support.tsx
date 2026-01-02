import { ShellOnly } from "@/components/restrictor";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, Copy, Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type SettingsSearch = {
  from?: string;
};

export const Route = createFileRoute("/settings/support")({
  component: SupportSettings,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return {
      from: (search.from as string) || undefined,
    };
  },
});

function SupportSettings() {
  const [copied, setCopied] = useState(false);
  const email = "advait@sixhuman.com";

  const handleCopyEmail = async () => {
    if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail
    }
  };

  const handleBookCall = () => {
    window.api.browser.openUrl("https://cal.com/advait-sixhuman/15min");
  };

  return (
    <ShellOnly>
      <div className="flex min-h-full flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Main Card */}
          <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-md">
            {/* Header Section */}
            <div className="border-b border-card-border px-6 py-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
                Get Support
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                Have questions or need help? Reach out directly to our founder
                for personalized support.
              </p>
            </div>

            {/* Contact Options */}
            <div className="space-y-1 p-2">
              {/* Email Option */}
              <div
                className={cn(
                  "group flex items-start gap-4 rounded-lg p-4 transition-all duration-200",
                  "hover:bg-accent/50"
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    "bg-primary/10 text-primary transition-colors duration-200",
                    "group-hover:bg-primary/15"
                  )}
                >
                  <Mail className="size-5" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <h3 className="text-sm font-medium text-card-foreground">
                    Email
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Send an email for detailed inquiries or feedback
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                      {email}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleCopyEmail}
                    >
                      {copied ? (
                        <Check className="size-4 text-green-500" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Book Call Option */}
              <div
                className={cn(
                  "group flex items-start gap-4 rounded-lg p-4 transition-all duration-200",
                  "hover:bg-accent/50"
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    "bg-primary/10 text-primary transition-colors duration-200",
                    "group-hover:bg-primary/15"
                  )}
                >
                  <Calendar className="size-5" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <h3 className="text-sm font-medium text-card-foreground">
                    Book a Call
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Schedule a 15-minute call to discuss your needs in person
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-fit"
                    onClick={handleBookCall}
                  >
                    <Calendar className="mr-2 size-4" />
                    Schedule Call
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ShellOnly>
  );
}
