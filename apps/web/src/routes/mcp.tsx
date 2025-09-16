import { ShellOnly } from "@/components/restrictor";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mcp")({
  component: MCP,
});

function MCP() {
  return (
    <ShellOnly>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP</h1>
          <p className="text-muted-foreground">
            Model Context Protocol - Manage connections and integrations.
          </p>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">MCP Connections</h2>
          <p className="text-muted-foreground">
            MCP server connections and protocol management will be implemented
            here.
          </p>
        </div>
      </div>
    </ShellOnly>
  );
}
