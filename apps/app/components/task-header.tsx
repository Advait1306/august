import { Button } from "./ui/button";
import { FolderIcon } from "lucide-react";
import { Agent } from "@jupiter/sync/zero/zero-schema.gen";

interface TaskHeaderProps {
  agent?: Agent;
  cwd: string;
  defaultCwd: string;
}

export function TaskHeader({ agent, cwd, defaultCwd }: TaskHeaderProps) {
  return (
    <div className="px-4 py-2 w-full h-[50px] border-b border-border flex items-center justify-between">
      {agent ? <span className="text-md">{agent?.name}</span> : <div />}
      {cwd && cwd !== defaultCwd && (
        <Button variant="ghost" className="rounded" size="sm" disabled>
          <span className="text-xs flex items-center gap-1">
            <FolderIcon className="w-4 h-4" />
            {cwd.match(/[^/\\]+$/)?.[0] || "Folder"}
          </span>
        </Button>
      )}
    </div>
  );
}
