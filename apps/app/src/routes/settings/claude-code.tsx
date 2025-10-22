import { ShellOnly } from "@/components/restrictor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { createFileRoute } from "@tanstack/react-router";
import { useSettingsSection } from "@/src/contexts/settings-context";

type SettingsSearch = {
  from?: string;
};

export const Route = createFileRoute("/settings/claude-code")({
  component: ClaudeCodeSettings,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return {
      from: (search.from as string) || undefined,
    };
  },
});

function ClaudeCodeSettings() {
  const [claudeCode, updateClaudeCode] = useSettingsSection("claudeCode");

  return (
    <ShellOnly>
      <div className="p-4 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold">Claude Code</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Claude Code settings
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="binaryPath">Binary Path</Label>
            <Input
              id="binaryPath"
              type="text"
              value={claudeCode.binaryPath}
              onChange={(e) =>
                updateClaudeCode({ binaryPath: e.target.value })
              }
              placeholder="/path/to/claude-code"
            />
            <p className="text-sm text-muted-foreground">
              Path to the Claude Code binary
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoUpdate">Auto Update</Label>
              <p className="text-sm text-muted-foreground">
                Automatically update Claude Code
              </p>
            </div>
            <Switch
              id="autoUpdate"
              checked={claudeCode.autoUpdate}
              onCheckedChange={(checked) =>
                updateClaudeCode({ autoUpdate: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enableLogging">Enable Logging</Label>
              <p className="text-sm text-muted-foreground">
                Enable detailed logging for debugging
              </p>
            </div>
            <Switch
              id="enableLogging"
              checked={claudeCode.enableLogging}
              onCheckedChange={(checked) =>
                updateClaudeCode({ enableLogging: checked })
              }
            />
          </div>
        </div>
      </div>
    </ShellOnly>
  );
}
