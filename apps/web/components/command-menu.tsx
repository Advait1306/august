import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  createContext,
  useContext,
  type ComponentType,
  Fragment,
  type ReactNode,
} from "react";

import {
  Bot,
  CheckSquare,
  FolderKanban,
  Settings,
  User,
  Sun,
  Moon,
  Monitor,
  Play,
  Archive,
  Trash2,
} from "lucide-react";
import { useTheme } from "@/src/contexts/theme-context";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { MCPIcon } from "@/components/icons/MCPIcon";
import { Kbd, KbdKey } from "@/components/ui/kibo-ui/kbd";
import { useNavigate } from "@tanstack/react-router";

export type CommandItem =
  | { type: "url"; url: string; label?: string }
  | { type: "action"; action: () => void; label?: string };

type CommandMenuItemBase = {
  id: string;
  title: string;
  icon: ComponentType<any>;
  shortcut?: string[];
};

type CommandMenuItem = CommandMenuItemBase & CommandItem;

export type CommandMenuContextItemType = "project" | "task";

export type CommandMenuContextItem = {
  type: CommandMenuContextItemType;
  id: string;
  name: string;
  data: Record<string, any>;
};

interface CommandMenuContextValue {
  addItemToContext: (
    type: CommandMenuContextItemType,
    id: string,
    name: string,
    data?: Record<string, any>
  ) => void;
  removeContextItem: () => void;
}

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export const useCommandMenu = () => {
  const context = useContext(CommandMenuContext);
  if (!context) {
    throw new Error("useCommandMenu must be used within a CommandMenuProvider");
  }
  return context;
};

interface CommandMenuProviderProps {
  children: ReactNode;
}

export function CommandMenuProvider({ children }: CommandMenuProviderProps) {
  const [contextItem, setContextItem] = useState<CommandMenuContextItem | null>(
    null
  );
  const [open, setOpen] = useState(false);
  const [resetRequired, setResetRequired] = useState(false);

  useEffect(() => {
    if (!open && resetRequired) {
      setContextItem(null);
      setResetRequired(false);
    }
  }, [open, resetRequired]);

  const addItemToContext = useCallback(
    (
      type: CommandMenuContextItemType,
      id: string,
      name: string,
      data: Record<string, any> = {}
    ) => {
      setContextItem({ type, id, name, data });
    },
    []
  );

  const removeContextItem = useCallback(() => {
    if (!open) {
      setContextItem(null);
    }
  }, [open]);

  const contextValue = useMemo(
    () => ({
      addItemToContext,
      removeContextItem,
    }),
    [addItemToContext, removeContextItem]
  );

  return (
    <CommandMenuContext.Provider value={contextValue}>
      {children}
      <CommandMenuDialog
        contextItem={contextItem}
        open={open}
        setOpen={setOpen}
        setIsResetRequired={setResetRequired}
      />
    </CommandMenuContext.Provider>
  );
}

function CommandMenuDialog({
  contextItem,
  open,
  setOpen,
  setIsResetRequired,
}: {
  contextItem: CommandMenuContextItem | null;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsResetRequired: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [keySequence, setKeySequence] = useState<string[]>([]);
  const keySequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  const commands = useMemo<
    Array<{ group: string; items: CommandMenuItem[] }>
  >(() => {
    const baseCommands: Array<{ group: string; items: CommandMenuItem[] }> = [
      {
        group: "Navigation",
        items: [
          {
            id: "tasks",
            title: "Tasks",
            icon: CheckSquare,
            type: "url" as const,
            url: "/tasks",
            shortcut: ["G", "T"],
          },
          {
            id: "projects",
            title: "Projects",
            icon: FolderKanban,
            type: "url" as const,
            url: "/projects",
            shortcut: ["G", "P"],
          },
          {
            id: "agents",
            title: "Agents",
            icon: Bot,
            type: "url" as const,
            url: "/agents",
            shortcut: ["G", "A"],
          },
          {
            id: "mcp",
            title: "MCP",
            icon: MCPIcon,
            type: "url" as const,
            url: "/mcp",
            shortcut: ["G", "M"],
          },
        ],
      },
      {
        group: "Settings",
        items: [
          {
            id: "settings",
            title: "Settings",
            icon: Settings,
            type: "action" as const,
            action: () => console.log("Settings clicked"),
          },
          {
            id: "profile",
            title: "Profile",
            icon: User,
            type: "action" as const,
            action: () => console.log("Profile clicked"),
          },
        ],
      },
      {
        group: "Theme",
        items: [
          {
            id: "theme-light",
            title: "Light",
            icon: Sun,
            type: "action" as const,
            action: () => setTheme("light"),
          },
          {
            id: "theme-dark",
            title: "Dark",
            icon: Moon,
            type: "action" as const,
            action: () => setTheme("dark"),
          },
          {
            id: "theme-system",
            title: "System",
            icon: Monitor,
            type: "action" as const,
            action: () => setTheme("system"),
          },
        ],
      },
    ];

    // Add contextual commands if there's a context item
    if (contextItem) {
      const contextCommands: CommandMenuItem[] = [];

      if (contextItem.type === "project") {
        contextCommands.push(
          {
            id: "start-task-with-project",
            title: `Start task on ${contextItem.name}`,
            icon: Play,
            type: "url" as const,
            url: `/tasks?project=${contextItem.id}`,
          },
          {
            id: "start-task-with-claude-code",
            title: `Start task on ${contextItem.name} with Claude Code`,
            icon: Bot,
            type: "url" as const,
            url: `/tasks?project=${contextItem.id}&agent=claude-code`,
          }
        );
      } else if (contextItem.type === "task") {
        contextCommands.push(
          {
            id: "archive-task",
            title: `Archive Task`,
            icon: Archive,
            type: "action" as const,
            action: () => {
              // TODO: Implement archive functionality
              console.log("Archive thread:", contextItem.id);
            },
          },
          {
            id: "delete-task",
            title: `Delete Task`,
            icon: Trash2,
            type: "action" as const,
            action: () => {
              // TODO: Implement delete functionality
              console.log("Delete thread:", contextItem.id);
            },
          }
        );
      }

      if (contextCommands.length > 0) {
        baseCommands.unshift({
          group: `${contextItem.name}`,
          items: contextCommands,
        });
      }
    }

    return baseCommands;
  }, [setTheme, contextItem]);

  const runCommand = useCallback(
    (command: CommandItem) => {
      if (contextItem) {
        setIsResetRequired(true);
      }
      setOpen(false);
      if (command.type === "url") {
        // TODO: Fix type here
        navigate(command.url as any);
      } else if (command.type === "action") {
        command.action();
      }
    },
    [contextItem, navigate, setIsResetRequired, setOpen]
  );

  // Reset key sequence when focus changes or when certain global events occur
  useEffect(() => {
    const resetKeySequence = () => {
      setKeySequence([]);
      if (keySequenceTimeoutRef.current) {
        clearTimeout(keySequenceTimeoutRef.current);
        keySequenceTimeoutRef.current = null;
      }
    };

    // Reset on focus change, mouse clicks, or when modals open
    const handleFocusChange = () => resetKeySequence();
    const handleMouseDown = () => resetKeySequence();

    window.addEventListener("blur", handleFocusChange);
    window.addEventListener("focus", handleFocusChange);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("blur", handleFocusChange);
      window.removeEventListener("focus", handleFocusChange);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Handle command menu toggle
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prevOpen) => !prevOpen);
        return;
      }

      // Skip hotkey handling if typing in input fields or interacting with certain elements
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable = target.isContentEditable;
        // Check for various interactive elements that should prevent shortcuts
        if (
          isEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.closest('[role="dialog"]') ||
          target.closest('[role="menu"]') ||
          target.closest('[role="listbox"]') ||
          target.closest('[role="combobox"]') ||
          target.hasAttribute("contenteditable")
        ) {
          return;
        }
      }

      // Handle command shortcuts when menu is closed
      if (!open && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        const now = Date.now();

        // Clear existing timeout
        if (keySequenceTimeoutRef.current) {
          clearTimeout(keySequenceTimeoutRef.current);
        }

        // Reset sequence if too much time has passed (more than 1 second)
        const shouldReset = now - lastKeyTimeRef.current > 1000;
        const newSequence = shouldReset ? [key] : [...keySequence, key];

        lastKeyTimeRef.current = now;
        setKeySequence(newSequence);

        // Check if any command matches the current sequence
        for (const group of commands) {
          for (const item of group.items) {
            if (item.shortcut) {
              const shortcutKeys = item.shortcut.map((k) => k.toLowerCase());

              // Check if current sequence matches the shortcut
              if (
                shortcutKeys.length === newSequence.length &&
                shortcutKeys.every((k, i) => k === newSequence[i])
              ) {
                e.preventDefault();
                runCommand(item);
                setKeySequence([]);
                return;
              }
            }
          }
        }

        // Set timeout to clear sequence if no more keys are pressed
        keySequenceTimeoutRef.current = setTimeout(() => {
          setKeySequence([]);
        }, 1000);
      }
    };

    document.addEventListener("keydown", down);
    return () => {
      document.removeEventListener("keydown", down);
      if (keySequenceTimeoutRef.current) {
        clearTimeout(keySequenceTimeoutRef.current);
      }
    };
  }, [open, commands, keySequence, runCommand, setOpen]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Menu"
      description="Type a command or search..."
    >
      {contextItem && (
        <div className="flex items-center gap-2 p-3 border-b">
          <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
            {contextItem.name}
          </div>
        </div>
      )}
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {commands.map((group) => (
          <Fragment key={group.group}>
            <CommandGroup heading={group.group}>
              {group.items.map((item) => (
                <CommandItem key={item.id} onSelect={() => runCommand(item)}>
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.title}</span>
                  {item.shortcut && (
                    <div className="ml-auto flex gap-2 items-center">
                      <Kbd>
                        <KbdKey>{item.shortcut[0]}</KbdKey>
                      </Kbd>
                      <span className="text-[12px] text-muted-foreground">
                        then
                      </span>
                      <Kbd>
                        <KbdKey>{item.shortcut[1]}</KbdKey>
                      </Kbd>
                    </div>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
