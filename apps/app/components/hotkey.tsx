/**
 * @Advait
 * This component is completely vibe-coded and I don't fully understand how it works,
 * but testing over various scenarios in dev mode shows that it works as required.
 *
 * As @vivek says, I'm an entrepreneur and not an engineer, so I don't have strict
 * requirements of understanding every engineering detail (even though I'd love to), in exchange
 * for shipping speed.
 */

import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  type KeyboardEventHandler,
  type RefObject,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type HotkeyOption = {
  label: string;
  value: string;
  children?: HotkeyOption[];
};

export type HotkeyProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  options: HotkeyOption[];
  trigger?: string;
  onSelect?: (value: string) => void;
};

// State type for reducer
type MenuState = {
  showMenu: boolean;
  triggerPos: number;
  anchorPosition: { top: number; left: number };
  selectedIndex: number;
  query: string;
  currentOptions: HotkeyOption[];
  optionStack: HotkeyOption[][];
};

// Action types
type MenuAction =
  | {
      type: "OPEN_MENU";
      payload: {
        triggerPos: number;
        anchorPosition: { top: number; left: number };
        options: HotkeyOption[];
      };
    }
  | { type: "CLOSE_MENU" }
  | { type: "UPDATE_QUERY"; payload: string }
  | { type: "UPDATE_ANCHOR_POSITION"; payload: { top: number; left: number } }
  | { type: "SET_SELECTED_INDEX"; payload: number }
  | { type: "INCREMENT_SELECTED_INDEX"; payload: number }
  | { type: "DECREMENT_SELECTED_INDEX"; payload: number }
  | { type: "NAVIGATE_INTO"; payload: HotkeyOption[] }
  | { type: "NAVIGATE_BACK" }
  | { type: "RESET_TO_ROOT"; payload: HotkeyOption[] };

// Reducer
function menuReducer(state: MenuState, action: MenuAction): MenuState {
  switch (action.type) {
    case "OPEN_MENU":
      return {
        ...state,
        showMenu: true,
        triggerPos: action.payload.triggerPos,
        anchorPosition: action.payload.anchorPosition,
        selectedIndex: 0,
        query: "",
        currentOptions: action.payload.options,
        optionStack: [],
      };
    case "CLOSE_MENU":
      return {
        ...state,
        showMenu: false,
      };
    case "UPDATE_QUERY":
      return {
        ...state,
        query: action.payload,
        selectedIndex: 0,
      };
    case "UPDATE_ANCHOR_POSITION":
      return {
        ...state,
        anchorPosition: action.payload,
      };
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
        query: "",
        selectedIndex: 0,
      };
    case "NAVIGATE_BACK":
      if (state.optionStack.length > 0) {
        const previousOptions = state.optionStack[state.optionStack.length - 1];
        return {
          ...state,
          optionStack: state.optionStack.slice(0, -1),
          currentOptions: previousOptions,
          query: "",
          selectedIndex: 0,
        };
      }
      // If at root level, close the menu
      return {
        ...state,
        showMenu: false,
        query: "",
      };
    case "RESET_TO_ROOT":
      return {
        ...state,
        currentOptions: action.payload,
        optionStack: [],
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
  opts: HotkeyOption[],
  parentPath: string[] = []
): Array<HotkeyOption & { path: string[] }> {
  const result: Array<HotkeyOption & { path: string[] }> = [];

  for (const option of opts) {
    const currentPath = [...parentPath, option.label];
    result.push({ ...option, path: currentPath });

    if (option.children && option.children.length > 0) {
      result.push(...flattenOptions(option.children, currentPath));
    }
  }

  return result;
}

// Custom hook for caret positioning with Portal
function useCaretPosition() {
  const measurementDivRef = useRef<HTMLDivElement>(null);

  const getCaretCoordinates = useCallback(
    (element: HTMLTextAreaElement, position: number) => {
      const div = measurementDivRef.current;
      if (!div) return { top: 0, left: 0 };

      const style = window.getComputedStyle(element);

      // Get padding values from textarea
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;

      // Apply styles to the measurement div
      div.style.font = style.font;
      div.style.fontSize = style.fontSize;
      div.style.fontFamily = style.fontFamily;
      div.style.fontWeight = style.fontWeight;
      div.style.letterSpacing = style.letterSpacing;
      div.style.lineHeight = style.lineHeight;
      div.style.textTransform = style.textTransform;
      div.style.wordSpacing = style.wordSpacing;
      div.style.width = `${element.clientWidth - paddingLeft - paddingRight}px`;

      const textBeforeCaret = element.value.substring(0, position);
      div.textContent = textBeforeCaret;

      const span = document.createElement("span");
      span.textContent = "|";
      div.appendChild(span);

      const coordinates = {
        top: span.offsetTop,
        left: span.offsetLeft,
      };

      // Clean up the span
      div.removeChild(span);

      return {
        top: coordinates.top + paddingTop - element.scrollTop,
        left: coordinates.left + paddingLeft - element.scrollLeft,
      };
    },
    []
  );

  // Render the measurement div via Portal
  const MeasurementPortal = useCallback(() => {
    if (typeof window === "undefined") return null;

    return createPortal(
      <div
        ref={measurementDivRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          padding: "0",
          border: "0",
          boxSizing: "content-box",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />,
      document.body
    );
  }, []);

  return { getCaretCoordinates, MeasurementPortal };
}

// Custom hook for filtered options
function useFilteredOptions(
  currentOptions: HotkeyOption[],
  query: string,
  options: HotkeyOption[]
) {
  return useCallback(() => {
    if (!query)
      return currentOptions.map((opt) => ({ ...opt, path: [opt.label] }));

    const allOptions = flattenOptions(options);
    return allOptions.filter(
      (option) =>
        fuzzyMatch(option.label, query) || fuzzyMatch(option.value, query)
    );
  }, [currentOptions, query, options])();
}

// Custom hook for keyboard navigation
function useKeyboardNavigation(
  state: MenuState,
  dispatch: React.Dispatch<MenuAction>,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  trigger: string,
  options: HotkeyOption[],
  getCaretCoordinates: (
    element: HTMLTextAreaElement,
    position: number
  ) => { top: number; left: number },
  filteredOptions: Array<HotkeyOption & { path: string[] }>,
  handleSelect: (option: HotkeyOption, fromSearch?: boolean) => void,
  handleGoBack: () => void
) {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      if (e.key === trigger && options.length > 0) {
        const cursorPos = e.currentTarget.selectionStart;

        setTimeout(() => {
          const textarea = textareaRef.current;
          if (!textarea) return;

          const coords = getCaretCoordinates(textarea, cursorPos + 1);

          dispatch({
            type: "OPEN_MENU",
            payload: {
              triggerPos: cursorPos,
              anchorPosition: {
                top: coords.top + textarea.offsetTop,
                left: coords.left + textarea.offsetLeft,
              },
              options,
            },
          });
        }, 0);
      }

      if (state.showMenu) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          handleGoBack();
        } else if (e.key === " ") {
          dispatch({ type: "CLOSE_MENU" });
        } else if (e.key === "Backspace" && state.query.length === 0) {
          e.preventDefault();
          e.stopPropagation();
          handleGoBack();
        } else if (e.key === "ArrowDown" && filteredOptions.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          dispatch({
            type: "INCREMENT_SELECTED_INDEX",
            payload: filteredOptions.length,
          });
        } else if (e.key === "ArrowUp" && filteredOptions.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          dispatch({
            type: "DECREMENT_SELECTED_INDEX",
            payload: filteredOptions.length,
          });
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          if (filteredOptions.length > 0) {
            handleSelect(filteredOptions[state.selectedIndex], !!state.query);
          }
        }
      }
    },
    [
      trigger,
      options,
      state.showMenu,
      state.query,
      state.selectedIndex,
      textareaRef,
      getCaretCoordinates,
      handleSelect,
      filteredOptions,
      handleGoBack,
      dispatch,
    ]
  );

  return handleKeyDown;
}

export function Hotkey({
  textareaRef,
  options,
  trigger = "@",
  onSelect,
}: HotkeyProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Use reducer for state management
  const [state, dispatch] = useReducer(menuReducer, {
    showMenu: false,
    triggerPos: 0,
    anchorPosition: { top: 0, left: 0 },
    selectedIndex: 0,
    query: "",
    currentOptions: options,
    optionStack: [],
  });

  const { getCaretCoordinates, MeasurementPortal } = useCaretPosition();

  const filteredOptions = useFilteredOptions(
    state.currentOptions,
    state.query,
    options
  );

  // Update anchor position when textarea scrolls
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !state.showMenu) return;

    const updatePosition = () => {
      const coords = getCaretCoordinates(textarea, state.triggerPos + 1);
      dispatch({
        type: "UPDATE_ANCHOR_POSITION",
        payload: {
          top: coords.top + textarea.offsetTop,
          left: coords.left + textarea.offsetLeft,
        },
      });
    };

    textarea.addEventListener("scroll", updatePosition);
    return () => textarea.removeEventListener("scroll", updatePosition);
  }, [state.showMenu, state.triggerPos, getCaretCoordinates, textareaRef]);

  const handleSelect = useCallback(
    (option: HotkeyOption, fromSearch = false) => {
      // If option has children and not from search, navigate into it
      if (option.children && option.children.length > 0 && !fromSearch) {
        dispatch({ type: "NAVIGATE_INTO", payload: option.children });
        return;
      }

      // Otherwise, select the option
      const textarea = textareaRef.current;
      if (textarea) {
        const currentValue = textarea.value;
        const beforeTrigger = currentValue.substring(0, state.triggerPos);
        const afterQuery = currentValue.substring(
          state.triggerPos + 1 + state.query.length
        );

        const newValue = beforeTrigger + afterQuery;

        // Use the native setter to properly update React's controlled component
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(textarea, newValue);
        } else {
          textarea.value = newValue;
        }

        // Trigger input event for React
        const event = new Event("input", { bubbles: true });
        textarea.dispatchEvent(event);

        // Set cursor position after removing the trigger and query
        const newCursorPos = state.triggerPos;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }

      dispatch({ type: "CLOSE_MENU" });
      onSelect?.(option.value);
    },
    [onSelect, textareaRef, state.triggerPos, state.query]
  );

  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (selectedItemRef.current && state.showMenu) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [state.selectedIndex, state.showMenu]);

  // Reset to root options when menu opens
  useEffect(() => {
    if (state.showMenu) {
      dispatch({ type: "RESET_TO_ROOT", payload: options });
    }
  }, [state.showMenu, options]);

  const handleGoBack = useCallback(() => {
    dispatch({ type: "NAVIGATE_BACK" });
  }, []);

  const handleKeyDown = useKeyboardNavigation(
    state,
    dispatch,
    textareaRef,
    trigger,
    options,
    getCaretCoordinates,
    filteredOptions,
    handleSelect,
    handleGoBack
  );

  // Attach keydown listener to textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const listener = (e: KeyboardEvent) => {
      handleKeyDown(
        e as unknown as Parameters<KeyboardEventHandler<HTMLTextAreaElement>>[0]
      );
    };

    textarea.addEventListener("keydown", listener);
    return () => textarea.removeEventListener("keydown", listener);
  }, [textareaRef, handleKeyDown]);

  // Listen for input events to update query
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !state.showMenu) return;

    const handleInput = () => {
      const cursorPos = textarea.selectionStart;
      const textAfterTrigger = textarea.value.substring(
        state.triggerPos + 1,
        cursorPos
      );

      if (cursorPos <= state.triggerPos) {
        dispatch({ type: "CLOSE_MENU" });
        return;
      }

      dispatch({ type: "UPDATE_QUERY", payload: textAfterTrigger });

      const coords = getCaretCoordinates(textarea, cursorPos);
      dispatch({
        type: "UPDATE_ANCHOR_POSITION",
        payload: {
          top: coords.top + textarea.offsetTop,
          left: coords.left + textarea.offsetLeft,
        },
      });
    };

    textarea.addEventListener("input", handleInput);
    return () => textarea.removeEventListener("input", handleInput);
  }, [textareaRef, state.showMenu, state.triggerPos, getCaretCoordinates]);

  return (
    <>
      <MeasurementPortal />
      <Popover
        open={state.showMenu}
        onOpenChange={(open) => {
          if (!open) {
            dispatch({ type: "CLOSE_MENU" });
          }
        }}
        modal={false}
      >
        <PopoverAnchor asChild>
          <span
            ref={anchorRef}
            style={{
              position: "absolute",
              top: `${state.anchorPosition.top}px`,
              left: `${state.anchorPosition.left}px`,
              width: "1px",
              height: "1px",
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          className="p-0 w-64"
          align="start"
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            // Prevent popover from closing on Escape - we handle it ourselves
            e.preventDefault();
          }}
        >
          <Command>
            <CommandList>
              <CommandGroup>
                {!state.query && state.optionStack.length > 0 && (
                  <CommandItem
                    onSelect={handleGoBack}
                    onMouseEnter={() =>
                      dispatch({ type: "SET_SELECTED_INDEX", payload: -1 })
                    }
                    onMouseDown={(e) => e.preventDefault()}
                    className="text-muted-foreground hover:!bg-transparent hover:!text-muted-foreground"
                  >
                    ← Back
                  </CommandItem>
                )}
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option, index) => {
                    const showPath =
                      state.query && option.path && option.path.length > 1;
                    const isParent =
                      !state.query &&
                      option.children &&
                      option.children.length > 0;

                    return (
                      <CommandItem
                        key={option.value}
                        ref={
                          index === state.selectedIndex ? selectedItemRef : null
                        }
                        onSelect={() => handleSelect(option, !!state.query)}
                        onMouseEnter={() =>
                          dispatch({
                            type: "SET_SELECTED_INDEX",
                            payload: index,
                          })
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        data-selected={index === state.selectedIndex}
                        className={cn(
                          index === state.selectedIndex
                            ? "bg-accent"
                            : "hover:!bg-transparent hover:!text-inherit"
                        )}
                      >
                        <span className="flex items-center justify-between w-full">
                          <span>
                            {showPath ? (
                              <span>
                                <span className="text-muted-foreground text-xs">
                                  {option.path.slice(0, -1).join(" > ")} {" > "}
                                </span>
                                {option.label}
                              </span>
                            ) : (
                              option.label
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
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
