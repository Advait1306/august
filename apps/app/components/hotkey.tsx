"use client";

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
  useRef,
  useState,
} from "react";

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

export function Hotkey({
  textareaRef,
  options,
  trigger = "@",
  onSelect,
}: HotkeyProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const [triggerPos, setTriggerPos] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [anchorPosition, setAnchorPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [currentOptions, setCurrentOptions] = useState<HotkeyOption[]>(options);
  const [optionStack, setOptionStack] = useState<HotkeyOption[][]>([]);

  // Fuzzy match function
  const fuzzyMatch = useCallback((str: string, query: string): boolean => {
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
  }, []);

  // Flatten all options including nested children with path information
  const flattenOptions = useCallback(
    (
      opts: HotkeyOption[],
      parentPath: string[] = []
    ): Array<HotkeyOption & { path: string[] }> => {
      const result: Array<HotkeyOption & { path: string[] }> = [];

      for (const option of opts) {
        const currentPath = [...parentPath, option.label];
        result.push({ ...option, path: currentPath });

        if (option.children && option.children.length > 0) {
          result.push(...flattenOptions(option.children, currentPath));
        }
      }

      return result;
    },
    []
  );

  // Filter options based on query
  const filteredOptions = useCallback(() => {
    if (!query) return currentOptions.map((opt) => ({ ...opt, path: [opt.label] }));

    // When searching, search across all options (including nested)
    const allOptions = flattenOptions(options);
    return allOptions.filter(
      (option) =>
        fuzzyMatch(option.label, query) || fuzzyMatch(option.value, query)
    );
  }, [currentOptions, query, fuzzyMatch, flattenOptions, options])();

  // Reset selected index when filtered options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredOptions.length]);

  const getCaretCoordinates = useCallback(
    (element: HTMLTextAreaElement, position: number) => {
      // Create a mirror div to measure caret position
      const div = document.createElement("div");
      const style = window.getComputedStyle(element);

      // Get padding values from textarea
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;

      // Copy all text-related styles exactly
      div.style.position = "absolute";
      div.style.visibility = "hidden";
      div.style.whiteSpace = "pre-wrap";
      div.style.overflowWrap = "break-word";
      div.style.font = style.font;
      div.style.fontSize = style.fontSize;
      div.style.fontFamily = style.fontFamily;
      div.style.fontWeight = style.fontWeight;
      div.style.letterSpacing = style.letterSpacing;
      div.style.lineHeight = style.lineHeight;
      div.style.textTransform = style.textTransform;
      div.style.wordSpacing = style.wordSpacing;
      // Match the content width (clientWidth minus padding)
      div.style.width = `${element.clientWidth - paddingLeft - paddingRight}px`;
      div.style.padding = "0";
      div.style.border = "0";
      div.style.boxSizing = "content-box";

      document.body.appendChild(div);

      const textBeforeCaret = element.value.substring(0, position);
      div.textContent = textBeforeCaret;

      const span = document.createElement("span");
      span.textContent = "|";
      div.appendChild(span);

      // Measure the offset of the span within the div
      const coordinates = {
        top: span.offsetTop,
        left: span.offsetLeft,
      };

      document.body.removeChild(div);

      return {
        top: coordinates.top + paddingTop - element.scrollTop,
        left: coordinates.left + paddingLeft - element.scrollLeft,
      };
    },
    []
  );

  // Update anchor position when textarea scrolls
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !showMenu) return;

    const updatePosition = () => {
      const coords = getCaretCoordinates(textarea, triggerPos + 1);
      setAnchorPosition({
        top: coords.top + textarea.offsetTop,
        left: coords.left + textarea.offsetLeft,
      });
    };

    textarea.addEventListener("scroll", updatePosition);
    return () => textarea.removeEventListener("scroll", updatePosition);
  }, [showMenu, triggerPos, getCaretCoordinates, textareaRef]);

  const handleSelect = useCallback(
    (option: HotkeyOption, fromSearch = false) => {
      // If option has children and not from search, navigate into it
      if (option.children && option.children.length > 0 && !fromSearch) {
        setOptionStack((prev) => [...prev, currentOptions]);
        setCurrentOptions(option.children);
        setQuery("");
        setSelectedIndex(0);
        return;
      }

      // Otherwise, select the option
      const textarea = textareaRef.current;
      if (textarea) {
        // Remove the trigger character and query text from the textarea
        const currentValue = textarea.value;
        const beforeTrigger = currentValue.substring(0, triggerPos);
        const afterQuery = currentValue.substring(triggerPos + 1 + query.length);

        textarea.value = beforeTrigger + afterQuery;

        // Trigger onChange event
        const event = new Event("input", { bubbles: true });
        textarea.dispatchEvent(event);

        // Set cursor position after removing the trigger and query
        const newCursorPos = triggerPos;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }

      setShowMenu(false);
      setQuery("");
      setCurrentOptions(options);
      setOptionStack([]);
      onSelect?.(option.value);
    },
    [onSelect, textareaRef, triggerPos, query, currentOptions, options]
  );

  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (selectedItemRef.current && showMenu) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, showMenu]);

  // Reset to root options when menu opens
  useEffect(() => {
    if (showMenu) {
      setCurrentOptions(options);
      setOptionStack([]);
    }
  }, [showMenu, options]);

  const handleGoBack = useCallback(() => {
    if (optionStack.length > 0) {
      const previousOptions = optionStack[optionStack.length - 1];
      setOptionStack((prev) => prev.slice(0, -1));
      setCurrentOptions(previousOptions);
      setQuery("");
      setSelectedIndex(0);
    } else {
      // If at root level, close the menu
      setShowMenu(false);
      setQuery("");
    }
  }, [optionStack]);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      if (e.key === trigger && options.length > 0) {
        // Track where trigger was typed
        const cursorPos = e.currentTarget.selectionStart;
        setTriggerPos(cursorPos);
        setSelectedIndex(0);
        setQuery("");

        // Calculate caret position and show popover
        setTimeout(() => {
          const textarea = textareaRef.current;
          if (!textarea) return;

          const coords = getCaretCoordinates(textarea, cursorPos + 1);

          // Add textarea's offset within its parent container
          setAnchorPosition({
            top: coords.top + textarea.offsetTop,
            left: coords.left + textarea.offsetLeft,
          });
          setShowMenu(true);
        }, 0);
      }

      // When menu is open, handle navigation and exit keys
      if (showMenu) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          handleGoBack();
        } else if (e.key === "Backspace" && query.length === 0) {
          // Go back on backspace if there's no query text
          e.preventDefault();
          e.stopPropagation();
          handleGoBack();
        } else if (e.key === "ArrowDown" && filteredOptions.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev + 1) % filteredOptions.length);
        } else if (e.key === "ArrowUp" && filteredOptions.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          if (filteredOptions.length > 0) {
            // Pass fromSearch=true if we're currently searching
            handleSelect(filteredOptions[selectedIndex], !!query);
          }
        }
      }
    },
    [trigger, options, showMenu, textareaRef, getCaretCoordinates, selectedIndex, handleSelect, filteredOptions, query, handleGoBack]
  );

  // Attach keydown listener to textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const listener = (e: KeyboardEvent) => {
      handleKeyDown(e as unknown as Parameters<KeyboardEventHandler<HTMLTextAreaElement>>[0]);
    };

    textarea.addEventListener("keydown", listener);
    return () => textarea.removeEventListener("keydown", listener);
  }, [textareaRef, handleKeyDown]);

  // Listen for input events to update query
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !showMenu) return;

    const handleInput = () => {
      const cursorPos = textarea.selectionStart;
      const textAfterTrigger = textarea.value.substring(
        triggerPos + 1,
        cursorPos
      );

      // If cursor is before trigger position, close menu
      if (cursorPos <= triggerPos) {
        setShowMenu(false);
        setQuery("");
        return;
      }

      // Update query
      setQuery(textAfterTrigger);

      // Update anchor position as text is typed
      const coords = getCaretCoordinates(textarea, cursorPos);
      setAnchorPosition({
        top: coords.top + textarea.offsetTop,
        left: coords.left + textarea.offsetLeft,
      });
    };

    textarea.addEventListener("input", handleInput);
    return () => textarea.removeEventListener("input", handleInput);
  }, [textareaRef, showMenu, triggerPos, getCaretCoordinates]);

  return (
    <Popover
      open={showMenu}
      onOpenChange={(open) => {
        setShowMenu(open);
        if (!open) {
          setQuery("");
        }
      }}
    >
      <PopoverAnchor asChild>
        <span
          ref={anchorRef}
          style={{
            position: "absolute",
            top: `${anchorPosition.top}px`,
            left: `${anchorPosition.left}px`,
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
      >
        <Command>
          <CommandList>
            <CommandGroup>
              {!query && optionStack.length > 0 && (
                <CommandItem
                  onSelect={handleGoBack}
                  className="text-muted-foreground"
                >
                  ← Back
                </CommandItem>
              )}
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const showPath = query && option.path && option.path.length > 1;
                  const isParent = !query && option.children && option.children.length > 0;

                  return (
                    <CommandItem
                      key={option.value}
                      ref={index === selectedIndex ? selectedItemRef : null}
                      onSelect={() => handleSelect(option, !!query)}
                      data-selected={index === selectedIndex}
                      className={index === selectedIndex ? "bg-accent" : ""}
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
  );
}
