import { PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

export type PromptMenuOption = {
  label: string;
  value: string;
  description?: string;
  children?: PromptMenuOption[];
  onSelect?: (value: string) => void;
};

export type PromptMenuProps = {
  onQuery?: (query: string) => void; // Called when user types to update query
  removeHotkeyCharacter?: () => void; // Called to remove the @ and close menu
  onClose?: () => void; // Called to close the menu without removing @
  options: PromptMenuOption[];
  className?: string;
};

// State type for reducer
type MenuState = {
  selectedIndex: number;
  currentOptions: PromptMenuOption[];
  optionStack: PromptMenuOption[][];
  direction: "forward" | "backward";
};

// Action types
type MenuAction =
  | { type: "SET_SELECTED_INDEX"; payload: number }
  | { type: "INCREMENT_SELECTED_INDEX"; payload: number }
  | { type: "DECREMENT_SELECTED_INDEX"; payload: number }
  | { type: "NAVIGATE_INTO"; payload: PromptMenuOption[] }
  | { type: "NAVIGATE_BACK" }
  | { type: "RESET_TO_ROOT"; payload: PromptMenuOption[] };

// Reducer
function menuReducer(state: MenuState, action: MenuAction): MenuState {
  switch (action.type) {
    case "SET_SELECTED_INDEX":
      return {
        ...state,
        selectedIndex: action.payload,
      };
    case "INCREMENT_SELECTED_INDEX":
      return {
        ...state,
        selectedIndex: (state.selectedIndex + 1) % action.payload,
      };
    case "DECREMENT_SELECTED_INDEX":
      return {
        ...state,
        selectedIndex:
          (state.selectedIndex - 1 + action.payload) % action.payload,
      };
    case "NAVIGATE_INTO":
      return {
        ...state,
        optionStack: [...state.optionStack, state.currentOptions],
        currentOptions: action.payload,
        selectedIndex: 0,
        direction: "forward",
      };
    case "NAVIGATE_BACK":
      if (state.optionStack.length > 0) {
        const previousOptions = state.optionStack[state.optionStack.length - 1];
        return {
          ...state,
          optionStack: state.optionStack.slice(0, -1),
          currentOptions: previousOptions,
          selectedIndex: 0,
          direction: "backward",
        };
      }
      return state;
    case "RESET_TO_ROOT":
      return {
        ...state,
        currentOptions: action.payload,
        optionStack: [],
        selectedIndex: 0,
        direction: "backward",
      };
    default:
      return state;
  }
}

// Helper function for fuzzy matching
function fuzzyMatch(str: string, query: string): boolean {
  if (!query) return true;

  const lowerStr = str.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let queryIndex = 0;
  for (let i = 0; i < lowerStr.length && queryIndex < lowerQuery.length; i++) {
    if (lowerStr[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
}

// Helper function to flatten options
function flattenOptions(
  opts: PromptMenuOption[],
  parentPath: string[] = []
): Array<PromptMenuOption & { path: string[] }> {
  const result: Array<PromptMenuOption & { path: string[] }> = [];

  for (const option of opts) {
    const currentPath = [...parentPath, option.label];
    result.push({ ...option, path: currentPath });

    if (option.children && option.children.length > 0) {
      result.push(...flattenOptions(option.children, currentPath));
    }
  }

  return result;
}

export function PromptMenu({
  onQuery,
  removeHotkeyCharacter,
  onClose,
  options,
  className,
}: PromptMenuProps) {
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const isHotkeyMode = !!(onClose || removeHotkeyCharacter || onQuery);

  // Use reducer for state management
  const [state, dispatch] = useReducer(menuReducer, {
    selectedIndex: 0,
    currentOptions: options,
    optionStack: [],
    direction: "forward",
  });

  // Update state when options prop changes
  useEffect(() => {
    if (state.optionStack.length === 0) {
      // Only update if we're at root level
      dispatch({ type: "RESET_TO_ROOT", payload: options });
    }
  }, [options, state.optionStack.length]);

  // Filter options based on query
  const filteredOptions = useMemo(() => {
    if (!query) {
      const result = state.currentOptions.map((opt) => ({
        ...opt,
        path: [opt.label],
      }));
      console.log("filteredOptions (no query):", result, isHotkeyMode);
      return result;
    }

    const allOptions = flattenOptions(options);
    return allOptions.filter(
      (option) =>
        fuzzyMatch(option.label, query) || fuzzyMatch(option.value, query)
    );
  }, [state.currentOptions, query, options]);

  // Reset to root when query changes
  useEffect(() => {
    if (query) {
      dispatch({ type: "RESET_TO_ROOT", payload: options });
    }
  }, [query, options]);

  const handleSelect = useCallback(
    (option: PromptMenuOption, fromSearch = false) => {
      // If option has children, navigate into it
      if (option.children && option.children.length > 0) {
        // Clear query when navigating from search
        if (fromSearch) {
          setQuery("");
        }
        dispatch({ type: "NAVIGATE_INTO", payload: option.children });
        return;
      }

      // Otherwise, select the option
      option.onSelect?.(option.value);
      removeHotkeyCharacter?.(); // Remove @ character
      onClose?.(); // Close menu

      // In non-hotkey mode, reset to root and close the popover
      if (!isHotkeyMode) {
        dispatch({ type: "RESET_TO_ROOT", payload: options });
        if (popoverContentRef.current) {
          // Find the popover root and close it
          const popoverElement = popoverContentRef.current.closest(
            "[data-radix-popper-content-wrapper]"
          );
          if (popoverElement) {
            // Trigger escape to close
            const escapeEvent = new KeyboardEvent("keydown", {
              key: "Escape",
              code: "Escape",
              keyCode: 27,
              bubbles: true,
              cancelable: true,
            });
            popoverElement.dispatchEvent(escapeEvent);
          }
        }
      }
    },
    [removeHotkeyCharacter, onClose, isHotkeyMode, options]
  );

  const handleGoBack = useCallback(() => {
    // If at root level, close the menu
    if (state.optionStack.length === 0) {
      onClose?.();
    } else {
      dispatch({ type: "NAVIGATE_BACK" });
    }
  }, [state.optionStack.length, onClose]);

  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [state.selectedIndex]);

  // Call onQuery when query changes
  useEffect(() => {
    onQuery?.(query);
  }, [query, onQuery]);

  // Keyboard handler - capture all keys (only when used with hotkey)
  useEffect(() => {
    // Only enable custom keyboard handling when used with hotkey (has onClose, removeHotkeyCharacter, or onQuery)
    if (!onClose && !removeHotkeyCharacter && !onQuery) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === " ") {
        // Add space to query, then close menu
        onQuery?.(query + " ");
        onClose?.();
      } else if (e.key === "Escape") {
        handleGoBack();
      } else if (e.key === "Backspace") {
        if (query.length === 0) {
          // Remove @ character and close menu
          removeHotkeyCharacter?.();
          onClose?.();
        } else {
          setQuery((prev) => prev.slice(0, -1));
        }
      } else if (e.key === "ArrowDown" && filteredOptions.length > 0) {
        dispatch({
          type: "INCREMENT_SELECTED_INDEX",
          payload: filteredOptions.length,
        });
      } else if (e.key === "ArrowUp" && filteredOptions.length > 0) {
        dispatch({
          type: "DECREMENT_SELECTED_INDEX",
          payload: filteredOptions.length,
        });
      } else if (e.key === "Enter") {
        if (filteredOptions.length > 0) {
          handleSelect(filteredOptions[state.selectedIndex], !!query);
        }
      } else if (e.key === "Tab") {
        // Navigate into submenu if current option has children
        if (filteredOptions.length > 0) {
          const currentOption = filteredOptions[state.selectedIndex];
          if (currentOption.children && currentOption.children.length > 0) {
            // Clear query when navigating from search
            if (query) {
              setQuery("");
            }
            dispatch({
              type: "NAVIGATE_INTO",
              payload: currentOption.children,
            });
          }
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Character key - add to query
        setQuery((prev) => prev + e.key);
      }
    };

    // Use capture phase to ensure we intercept events before they reach other listeners
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    query,
    filteredOptions,
    state.selectedIndex,
    handleSelect,
    handleGoBack,
    onQuery,
    onClose,
    removeHotkeyCharacter,
  ]);

  return (
    <PopoverContent
      ref={popoverContentRef}
      className={cn("p-0 w-64 overflow-hidden relative", className)}
      align="start"
      side="bottom"
      onOpenAutoFocus={(e) => e.preventDefault()}
      onEscapeKeyDown={(e) => {
        // Only prevent default when using hotkey mode
        if (onClose || removeHotkeyCharacter || onQuery) {
          e.preventDefault();
        }
      }}
      onInteractOutside={(e) => {
        // Only prevent default when using hotkey mode
        if (onClose || removeHotkeyCharacter || onQuery) {
          e.preventDefault();
        }
        onClose?.();

        // Reset to root in non-hotkey mode when popover closes
        if (!isHotkeyMode) {
          dispatch({ type: "RESET_TO_ROOT", payload: options });
        }
      }}
    >
      <Command>
        <CommandList>
          <CommandGroup>
            <AnimatePresence
              mode="popLayout"
              initial={false}
              custom={state.direction}
            >
              <motion.div
                key={state.optionStack.length}
                custom={state.direction}
                variants={{
                  enter: (direction: "forward" | "backward") => ({
                    x: direction === "forward" ? "100%" : "-100%",
                    opacity: 0,
                  }),
                  center: {
                    x: 0,
                    opacity: 1,
                  },
                  exit: (direction: "forward" | "backward") => ({
                    x: direction === "forward" ? "-100%" : "100%",
                    opacity: 0,
                  }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  duration: 0.2,
                  ease: "easeInOut",
                }}
              >
                {!query && state.optionStack.length > 0 && (
                  <CommandItem
                    onSelect={handleGoBack}
                    onMouseEnter={() =>
                      dispatch({ type: "SET_SELECTED_INDEX", payload: -1 })
                    }
                    onMouseDown={(e) => {
                      // Only prevent default in hotkey mode
                      if (isHotkeyMode) {
                        e.preventDefault();
                      }
                    }}
                    className="text-muted-foreground hover:!bg-transparent hover:!text-muted-foreground"
                  >
                    ← Back
                  </CommandItem>
                )}
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option, index) => {
                    const showPath =
                      query && option.path && option.path.length > 1;
                    const isParent =
                      option.children && option.children.length > 0;

                    return (
                      <CommandItem
                        key={option.value}
                        ref={
                          index === state.selectedIndex ? selectedItemRef : null
                        }
                        onSubmit={(e) => e.preventDefault()}
                        onSelect={() => handleSelect(option, !!query)}
                        onMouseEnter={() =>
                          dispatch({
                            type: "SET_SELECTED_INDEX",
                            payload: index,
                          })
                        }
                        onMouseDown={(e) => {
                          // Only prevent default in hotkey mode
                          if (isHotkeyMode) {
                            e.preventDefault();
                          }
                        }}
                        data-selected={index === state.selectedIndex}
                        className={cn(
                          index === state.selectedIndex
                            ? "bg-accent"
                            : "hover:!bg-transparent hover:!text-inherit"
                        )}
                      >
                        <span className="flex items-center justify-between w-full">
                          <span className="flex flex-col">
                            <span>
                              {showPath ? (
                                <span>
                                  <span className="text-muted-foreground text-xs">
                                    {option.path.slice(0, -1).join(" > ")}{" "}
                                    {" > "}
                                  </span>
                                  {option.label}
                                </span>
                              ) : (
                                option.label
                              )}
                            </span>
                            {option.description && !showPath && (
                              <span className="text-muted-foreground text-xs">
                                {option.description}
                              </span>
                            )}
                          </span>
                          {isParent && (
                            <span className="text-muted-foreground">→</span>
                          )}
                        </span>
                      </CommandItem>
                    );
                  })
                ) : (
                  <CommandItem disabled>No matches found</CommandItem>
                )}
              </motion.div>
            </AnimatePresence>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}
