import { ShellOnly } from "@/components/restrictor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFileRoute } from "@tanstack/react-router";
import { useNestedSetting } from "@/src/contexts/settings-context";

type SettingsSearch = {
  from?: string;
};

export const Route = createFileRoute("/settings/appearance")({
  component: AppearanceSettings,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return {
      from: (search.from as string) || undefined,
    };
  },
});

function AppearanceSettings() {
  const [theme, setTheme] = useNestedSetting("appearance", "theme");
  const [fontSize, setFontSize] = useNestedSetting("appearance", "fontSize");
  const [compactMode, setCompactMode] = useNestedSetting(
    "appearance",
    "compactMode"
  );

  return (
    <ShellOnly>
      <div className="p-4 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the look and feel of the application
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="theme">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Select your preferred theme
              </p>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="fontSize">Font Size</Label>
              <p className="text-sm text-muted-foreground">
                Adjust the text size
              </p>
            </div>
            <Select value={fontSize} onValueChange={setFontSize}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="compactMode">Compact Mode</Label>
              <p className="text-sm text-muted-foreground">
                Reduce spacing and padding
              </p>
            </div>
            <Switch
              id="compactMode"
              checked={compactMode}
              onCheckedChange={setCompactMode}
            />
          </div>
        </div>
      </div>
    </ShellOnly>
  );
}
