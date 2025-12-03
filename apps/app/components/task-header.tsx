import { Button } from "./ui/button";
import { CheckCircle2Icon, CircleIcon, Loader2Icon } from "lucide-react";
import { Agent } from "@jupiter/sync/zero/zero-schema.gen";
import { TodoState } from "@/src/contexts/task-runtime";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TaskHeaderProps {
  agent?: Agent;
  cwd: string;
  defaultCwd: string;
  todoState: TodoState;
  isGenerating: boolean;
}

export function TaskHeader({
  agent,
  cwd,
  defaultCwd,
  todoState,
  isGenerating,
}: TaskHeaderProps) {
  const isTodoAvailable = todoState.length > 0;
  const completedCount = todoState.filter(
    (todo) => todo.status === "completed"
  ).length;
  const totalCount = todoState.length;
  const inProgressTodo = todoState.find(
    (todo) => todo.status === "in_progress"
  );
  const progressPercentage =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="absolute bg-accent/70 z-20 backdrop-blur-md px-4 py-2 w-full h-[54px] border-b border-border flex items-center justify-between">
      <div>
        {agent ? <span className="">{agent?.name}</span> : <div />}
        {cwd && cwd !== defaultCwd && (
          <span className="text-xs flex items-center gap-1 text-muted-foreground">
            Working in {cwd.match(/[^/\\]+$/)?.[0] || "Folder"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isTodoAvailable && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="rounded px-3 h-8">
                <div className="flex items-center gap-2">
                  {/* Active Task Form or Count */}
                  <span
                    className={cn(
                      "max-w-[300px] truncate",
                      inProgressTodo && isGenerating && "animate-pulse"
                    )}
                  >
                    {inProgressTodo
                      ? inProgressTodo.activeForm
                      : `${completedCount} tasks completed`}
                  </span>
                  {/* Circular Progress Indicator */}
                  <div className="relative w-4 h-4">
                    <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
                      {/* Background circle */}
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted-foreground/30"
                      />
                      {/* Progress circle */}
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${2 * Math.PI * 6}`}
                        strokeDashoffset={`${2 * Math.PI * 6 * (1 - progressPercentage / 100)}`}
                        className="text-primary transition-all duration-300"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm mb-3">Task Progress</h4>
                {todoState.map((todo, index) => (
                  <div
                    key={`${todo.content}-${index}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    {todo.status === "completed" ? (
                      <CheckCircle2Icon className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                    ) : todo.status === "in_progress" ? (
                      <Loader2Icon className="w-4 h-4 mt-0.5 text-blue-500 animate-spin flex-shrink-0" />
                    ) : (
                      <CircleIcon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        todo.status === "completed" &&
                          "line-through text-muted-foreground"
                      )}
                    >
                      {todo.status === "in_progress"
                        ? todo.activeForm
                        : todo.content}
                    </span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
