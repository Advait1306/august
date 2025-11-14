import { ShellOnly } from "@/components/restrictor";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createFileRoute } from "@tanstack/react-router";
import { useSettingsSection } from "@/src/contexts/settings-context";
import { useClaudeCodeInstallations } from "@/src/contexts/task-runtime";

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
  const installations = useClaudeCodeInstallations();

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
          <div className="flex flex-row justify-between">
            <div className="flex flex-col gap-2">
              <Label htmlFor="installation">Claude Code Installation</Label>
              <p className="text-sm text-muted-foreground">
                Select which Claude Code installation to use
              </p>
            </div>
            {installations.length === 0 ? (
              <div className="text-sm text-destructive">
                No Claude Code installations found
              </div>
            ) : (
              <Select
                value={
                  claudeCode.selectedInstallation?.path ||
                  installations[0]?.path
                }
                onValueChange={(path) => {
                  const installation = installations.find(
                    (i) => i.path === path
                  );
                  if (installation) {
                    updateClaudeCode({
                      selectedInstallation: installation,
                      ...(installation.source === "bundled" && {
                        inheritUserSettings: false,
                      }),
                    });
                  }
                }}
              >
                <SelectTrigger id="installation">
                  {(() => {
                    const selected =
                      claudeCode.selectedInstallation || installations[0];
                    if (!selected) {
                      return (
                        <SelectValue placeholder="Select an installation" />
                      );
                    }

                    if (selected.source === "bundled") {
                      return (
                        <span className="text-sm">Organisation Provided</span>
                      );
                    }

                    return (
                      <span className="text-sm">
                        {selected.version
                          ? `v${selected.version}`
                          : "Unknown version"}{" "}
                        - {selected.source}
                      </span>
                    );
                  })()}
                </SelectTrigger>
                <SelectContent>
                  {installations.map((installation) => (
                    <SelectItem
                      key={installation.path}
                      value={installation.path}
                    >
                      <div className="flex flex-col">
                        {installation.source === "bundled" ? (
                          <>
                            <span>Organisation Provided</span>
                            <span className="text-xs text-muted-foreground">
                              Will be billed to the organisation that's active
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              {installation.version
                                ? `v${installation.version}`
                                : "Unknown version"}{" "}
                              - {installation.source}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {installation.path}
                            </span>
                          </>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-row justify-between items-center">
            <div className="flex flex-col gap-2">
              <Label htmlFor="inherit-user-settings">
                Inherit User Settings
              </Label>
              <p className="text-sm text-muted-foreground">
                {claudeCode.selectedInstallation?.source === "bundled"
                  ? "Only available for non-bundled Claude Code installations"
                  : "Pass user settings to the local Claude Code instance"}
              </p>
            </div>
            <Switch
              id="inherit-user-settings"
              checked={
                claudeCode.selectedInstallation?.source === "bundled"
                  ? false
                  : claudeCode.inheritUserSettings
              }
              disabled={claudeCode.selectedInstallation?.source === "bundled"}
              onCheckedChange={(checked) =>
                updateClaudeCode({ inheritUserSettings: checked })
              }
            />
          </div>
        </div>
      </div>
    </ShellOnly>
  );
}
