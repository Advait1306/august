import { ShellOnly } from "@/components/restrictor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createFileRoute } from "@tanstack/react-router";
import { useNestedSetting } from "@/src/contexts/settings-context";

type SettingsSearch = {
  from?: string;
};

export const Route = createFileRoute("/settings/privacy")({
  component: PrivacySettings,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return {
      from: (search.from as string) || undefined,
    };
  },
});

function PrivacySettings() {
  const [analytics, setAnalytics] = useNestedSetting("privacy", "analytics");
  const [crashReporting, setCrashReporting] = useNestedSetting(
    "privacy",
    "crashReporting"
  );

  return (
    <ShellOnly>
      <div className="p-4 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold">Privacy</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your privacy preferences
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="analytics">Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Help improve the app by sharing usage data
              </p>
            </div>
            <Switch
              id="analytics"
              checked={analytics}
              onCheckedChange={setAnalytics}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="crashReporting">Crash Reporting</Label>
              <p className="text-sm text-muted-foreground">
                Automatically report crashes
              </p>
            </div>
            <Switch
              id="crashReporting"
              checked={crashReporting}
              onCheckedChange={setCrashReporting}
            />
          </div>
        </div>
      </div>
    </ShellOnly>
  );
}
