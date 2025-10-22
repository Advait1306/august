import { ShellOnly } from "@/components/restrictor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createFileRoute } from "@tanstack/react-router";
import { useNestedSetting } from "@/src/contexts/settings-context";

type SettingsSearch = {
  from?: string;
};

export const Route = createFileRoute("/settings/experimental")({
  component: ExperimentalSettings,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return {
      from: (search.from as string) || undefined,
    };
  },
});

function ExperimentalSettings() {
  const [enableExperimentalFeatures, setEnableExperimentalFeatures] =
    useNestedSetting("experimental", "enableExperimentalFeatures");

  return (
    <ShellOnly>
      <div className="p-4 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold">Experimental</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enable experimental features (use at your own risk)
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="experimental">Experimental Features</Label>
              <p className="text-sm text-muted-foreground">
                Enable features that are still in development
              </p>
            </div>
            <Switch
              id="experimental"
              checked={enableExperimentalFeatures}
              onCheckedChange={setEnableExperimentalFeatures}
            />
          </div>
        </div>
      </div>
    </ShellOnly>
  );
}
