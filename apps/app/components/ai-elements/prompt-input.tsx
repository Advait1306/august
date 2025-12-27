"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChatStatus, FileUIPart } from "ai";
import { Popover, PopoverAnchor } from "@/components/ui/popover";
import { createPortal } from "react-dom";
import { useMention } from "@/hooks/use-mention";
import { SelectedSkill } from "@/src/contexts/task-runtime";
import {
  ArrowUp,
  ImageIcon,
  Loader2Icon,
  PaperclipIcon,
  PlusIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import {
  type ChangeEventHandler,
  Children,
  type ClipboardEventHandler,
  type ComponentProps,
  createContext,
  type FormEvent,
  type FormEventHandler,
  Fragment,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AttachmentsContext = {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
};

const AttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputAttachments = () => {
  const context = useContext(AttachmentsContext);

  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput"
    );
  }

  return context;
};

export type PromptInputAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: FileUIPart & { id: string };
  className?: string;
};

export function PromptInputAttachment({
  data,
  className,
  ...props
}: PromptInputAttachmentProps) {
  const attachments = usePromptInputAttachments();

  return (
    <div
      className={cn("group relative h-14 w-14 rounded-md border", className)}
      key={data.id}
      {...props}
    >
      {data.mediaType?.startsWith("image/") && data.url ? (
        <img
          alt={data.filename || "attachment"}
          className="size-full rounded-md object-cover"
          height={56}
          src={data.url}
          width={56}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <PaperclipIcon className="size-4" />
        </div>
      )}
      <Button
        aria-label="Remove attachment"
        className="-right-1.5 -top-1.5 absolute h-6 w-6 rounded-full opacity-0 group-hover:opacity-100"
        onClick={() => attachments.remove(data.id)}
        size="icon"
        type="button"
        variant="outline"
      >
        <XIcon className="h-3 w-3" />
      </Button>
    </div>
  );
}

export type PromptInputAttachmentsProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: (attachment: FileUIPart & { id: string }) => React.ReactNode;
};

export function PromptInputAttachments({
  className,
  children,
  ...props
}: PromptInputAttachmentsProps) {
  const attachments = usePromptInputAttachments();
  const [height, setHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(() => {
      setHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      aria-live="polite"
      className={cn(
        "overflow-hidden transition-[height] duration-200 ease-out",
        className
      )}
      style={{ height: attachments.files.length ? height : 0 }}
      {...props}
    >
      <div className="flex flex-wrap gap-2 p-3 pt-3" ref={contentRef}>
        {attachments.files.map((file) => (
          <Fragment key={file.id}>{children(file)}</Fragment>
        ))}
      </div>
    </div>
  );
}

export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string;
};

export const PromptInputActionAddAttachments = ({
  label = "Add photos or files",
  ...props
}: PromptInputActionAddAttachmentsProps) => {
  const attachments = usePromptInputAttachments();

  return (
    <DropdownMenuItem
      {...props}
      onSelect={(e) => {
        e.preventDefault();
        attachments.openFileDialog();
      }}
    >
      <ImageIcon className="mr-2 size-4" /> {label}
    </DropdownMenuItem>
  );
};

export type PromptInputMessage = {
  text?: string;
  files?: FileUIPart[];
};

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit"
> & {
  accept?: string; // e.g., "image/*" or leave undefined for any
  multiple?: boolean;
  // When true, accepts drops anywhere on document. Default false (opt-in).
  globalDrop?: boolean;
  // Render a hidden input with given name and keep it in sync for native form posts. Default false.
  syncHiddenInput?: boolean;
  // Minimal constraints
  maxFiles?: number;
  maxFileSize?: number; // bytes
  onError?: (err: {
    code: "max_files" | "max_file_size" | "accept";
    message: string;
  }) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => void;
};

export const PromptInput = ({
  className,
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Find nearest form to scope drag & drop
  useEffect(() => {
    const root = anchorRef.current?.closest("form");
    if (root instanceof HTMLFormElement) {
      formRef.current = root;
    }
  }, []);

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const matchesAccept = useCallback(
    (f: File) => {
      if (!accept || accept.trim() === "") {
        return true;
      }
      // Simple check: if accept includes "image/*", filter to images; otherwise allow.
      if (accept.includes("image/*")) {
        return f.type.startsWith("image/");
      }
      return true;
    },
    [accept]
  );

  const add = useCallback(
    (files: File[] | FileList) => {
      const incoming = Array.from(files);
      const accepted = incoming.filter((f) => matchesAccept(f));
      if (accepted.length === 0) {
        onError?.({
          code: "accept",
          message: "No files match the accepted types.",
        });
        return;
      }
      const withinSize = (f: File) =>
        maxFileSize ? f.size <= maxFileSize : true;
      const sized = accepted.filter(withinSize);
      if (sized.length === 0 && accepted.length > 0) {
        onError?.({
          code: "max_file_size",
          message: "All files exceed the maximum size.",
        });
        return;
      }
      setItems((prev) => {
        const capacity =
          typeof maxFiles === "number"
            ? Math.max(0, maxFiles - prev.length)
            : undefined;
        const capped =
          typeof capacity === "number" ? sized.slice(0, capacity) : sized;
        if (typeof capacity === "number" && sized.length > capacity) {
          onError?.({
            code: "max_files",
            message: "Too many files. Some were not added.",
          });
        }
        const next: (FileUIPart & { id: string })[] = [];
        for (const file of capped) {
          next.push({
            id: nanoid(),
            type: "file",
            url: URL.createObjectURL(file),
            mediaType: file.type,
            filename: file.name,
          });
        }
        return prev.concat(next);
      });
    },
    [matchesAccept, maxFiles, maxFileSize, onError]
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const found = prev.find((file) => file.id === id);
      if (found?.url) {
        URL.revokeObjectURL(found.url);
      }
      return prev.filter((file) => file.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setItems((prev) => {
      for (const file of prev) {
        if (file.url) {
          URL.revokeObjectURL(file.url);
        }
      }
      return [];
    });
  }, []);

  // Note: File input cannot be programmatically set for security reasons
  // The syncHiddenInput prop is no longer functional
  useEffect(() => {
    if (syncHiddenInput && inputRef.current) {
      // Clear the input when items are cleared
      if (items.length === 0) {
        inputRef.current.value = "";
      }
    }
  }, [items, syncHiddenInput]);

  // Attach drop handlers on nearest form and document (opt-in)
  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [add]);

  useEffect(() => {
    if (!globalDrop) {
      return;
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (event.currentTarget.files) {
      add(event.currentTarget.files);
    }
  };

  const convertBlobUrlToDataUrl = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const text = (formData.get("message") as string) || "";

    // Convert blob URLs to data URLs asynchronously
    Promise.all(
      items.map(async ({ id, ...item }) => {
        if (item.url && item.url.startsWith("blob:")) {
          return {
            ...item,
            url: await convertBlobUrlToDataUrl(item.url),
          };
        }
        return item;
      })
    ).then((files: FileUIPart[]) => {
      onSubmit({ text, files }, event);
      clear();
    });
  };

  const ctx = useMemo<AttachmentsContext>(
    () => ({
      files: items.map((item) => ({ ...item, id: item.id })),
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef: inputRef,
    }),
    [items, add, remove, clear, openFileDialog]
  );

  return (
    <AttachmentsContext.Provider value={ctx}>
      <span aria-hidden="true" className="hidden" ref={anchorRef} />
      <input
        accept={accept}
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      <form
        className={cn(
          "w-full overflow-hidden rounded-xl border border-popover-border bg-popover shadow-sm",
          className
        )}
        onSubmit={handleSubmit}
        {...props}
      >
        {children}
      </form>
    </AttachmentsContext.Provider>
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({
  className,
  ...props
}: PromptInputBodyProps) => (
  <div className={cn(className, "flex flex-col")} {...props} />
);

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

export type PromptInputTextareaProps = Omit<
  ComponentProps<typeof Textarea>,
  "value" | "onChange"
> & {
  hotkey?: string;
  hotkeyMenu?: (params: {
    onQuery: (query: string) => void;
    removeHotkeyCharacter: () => void;
    onClose: () => void;
  }) => React.ReactNode;
  skills?: SelectedSkill[];
  selectedSkills?: SelectedSkill[];
  onSkillsChange?: (skills: SelectedSkill[]) => void;
  value: string;
  onInputChange: (value: string) => void;
};

export const PromptInputTextarea = ({
  onInputChange,
  className,
  placeholder = "What would you like me to do?",
  hotkey = "/",
  hotkeyMenu,
  skills = [],
  selectedSkills = [],
  onSkillsChange,
  value,
  ...props
}: PromptInputTextareaProps) => {
  const attachments = usePromptInputAttachments();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [triggerPos, setTriggerPos] = useState(0);
  const [anchorPosition, setAnchorPosition] = useState({ top: 0, left: 0 });
  const [mentionAnchorPosition, setMentionAnchorPosition] = useState({
    top: 0,
    left: 0,
  });
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const { getCaretCoordinates, MeasurementPortal } = useCaretPosition();

  // Use our custom mention hook
  const mention = useMention({
    options: skills,
    selectedMentions: selectedSkills,
    onSelectedMentionsChange: onSkillsChange ?? (() => {}),
    inputValue: value,
    onInputValueChange: onInputChange,
    trigger: "@",
  });

  // Reset highlighted index and calculate position when mention menu opens
  useEffect(() => {
    if (
      mention.isOpen &&
      mention.triggerIndex !== null &&
      textareaRef.current
    ) {
      setHighlightedIndex(0);

      // Calculate position at the @ trigger
      const textarea = textareaRef.current;
      const coords = getCaretCoordinates(textarea, mention.triggerIndex + 1);
      const rect = textarea.getBoundingClientRect();

      setMentionAnchorPosition({
        top: rect.top + coords.top,
        left: rect.left + coords.left,
      });
    }
  }, [mention.isOpen, mention.triggerIndex, getCaretCoordinates]);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    // Handle mention menu keyboard navigation
    if (mention.isOpen && mention.filteredOptions.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) =>
            i < mention.filteredOptions.length - 1 ? i + 1 : 0
          );
          return;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) =>
            i > 0 ? i - 1 : mention.filteredOptions.length - 1
          );
          return;
        case "Enter":
        case "Tab":
          e.preventDefault();
          mention.selectOption(mention.filteredOptions[highlightedIndex]);
          return;
        case "Escape":
          e.preventDefault();
          mention.close();
          return;
      }
    }

    // Don't handle Enter if any menu is open (let menu handle it)
    if ((showMenu || mention.isOpen) && e.key === "Enter") {
      return;
    }

    // Detect hotkey trigger
    if (e.key === hotkey && hotkeyMenu) {
      const cursorPos = e.currentTarget.selectionStart;
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          const coords = getCaretCoordinates(textarea, cursorPos + 1);
          setAnchorPosition({
            top: coords.top + textarea.offsetTop,
            left: coords.left + textarea.offsetLeft,
          });
        }
        setShowMenu(true);
        setTriggerPos(cursorPos);
      }, 0);
    }

    if (e.key === "Enter") {
      // Don't submit if IME composition is in progress
      if (e.nativeEvent.isComposing) {
        return;
      }

      if (e.shiftKey) {
        // Allow newline
        return;
      }

      // Submit on Enter (without Shift)
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }

    // Let mention hook handle its keyboard events
    mention.onKeyDown(e);
  };

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    const items = event.clipboardData?.items;

    if (!items) {
      return;
    }

    const files: File[] = [];

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      attachments.add(files);
    }
  };

  // Handle query updates from hotkey menu - update textarea value
  const handleQuery = useCallback(
    (query: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const currentValue = value;
      const beforeTrigger = currentValue.substring(0, triggerPos + 1);
      const afterCursor = currentValue.substring(triggerPos + 1);

      const newValue = beforeTrigger + query + afterCursor;
      onInputChange(newValue);

      // Set cursor position after the query
      setTimeout(() => {
        const newCursorPos = triggerPos + 1 + query.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [triggerPos, value, onInputChange]
  );

  // Handle removing hotkey character
  const removeHotkeyCharacter = useCallback(() => {
    const currentValue = value;
    const beforeTrigger = currentValue.substring(0, triggerPos);
    const afterTrigger = currentValue.substring(triggerPos + 1);

    onInputChange(beforeTrigger + afterTrigger);

    setTimeout(() => {
      textareaRef.current?.setSelectionRange(triggerPos, triggerPos);
      textareaRef.current?.focus();
    }, 0);
  }, [triggerPos, value, onInputChange]);

  // Handle closing menu without selection
  const handleClose = useCallback(() => {
    setShowMenu(false);
    textareaRef.current?.focus();
  }, []);

  // Build highlighted text with styled mentions
  const renderHighlightedText = () => {
    if (!value || mention.matches.length === 0) {
      return (
        <span className="invisible whitespace-pre-wrap">{value || " "}</span>
      );
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Sort matches by start position
    const sortedMatches = [...mention.matches].sort(
      (a, b) => a.start - b.start
    );

    for (const match of sortedMatches) {
      // Add text before this match
      if (match.start > lastIndex) {
        parts.push(
          <span
            key={`text-${lastIndex}`}
            className="invisible whitespace-pre-wrap"
          >
            {value.slice(lastIndex, match.start)}
          </span>
        );
      }

      // Add the highlighted mention
      parts.push(
        <mark
          key={`mention-${match.start}`}
          className="rounded bg-blue-200 text-blue-950 dark:bg-blue-800 dark:text-blue-50"
        >
          {value.slice(match.start, match.end)}
        </mark>
      );

      lastIndex = match.end;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(
        <span
          key={`text-${lastIndex}`}
          className="invisible whitespace-pre-wrap"
        >
          {value.slice(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <>
      <MeasurementPortal />
      <div className="relative">
        {/* Highlight overlay - positioned behind textarea */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap wrap-break-word",
            "p-3 text-sm",
            className
          )}
        >
          {renderHighlightedText()}
        </div>

        {/* Actual textarea */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={mention.onInputChange}
          className={cn(
            "relative w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0",
            "field-sizing-content bg-transparent dark:bg-transparent",
            "max-h-48 min-h-16",
            "focus-visible:ring-0",
            className
          )}
          name="message"
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          {...props}
        />

        {/* Mention menu dropdown - using Portal to escape overflow:hidden */}
        {mention.isOpen &&
          mention.filteredOptions.length > 0 &&
          createPortal(
            <div
              ref={menuRef}
              className={cn(
                "absolute min-w-48 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
                "animate-in fade-in-0 zoom-in-95"
              )}
              style={{
                top: mentionAnchorPosition.top - 8,
                left: mentionAnchorPosition.left,
                transform: "translateY(-100%)",
              }}
            >
              {mention.filteredOptions.map((option, index) => (
                <div
                  key={option.id}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                    index === highlightedIndex &&
                      "bg-accent text-accent-foreground"
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    mention.selectOption(option);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{option.name}</span>
                    {option.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {option.description}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>,
            document.body
          )}

        {/* Hotkey menu (/) */}
        {showMenu && hotkeyMenu && (
          <Popover open={true} modal={false}>
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
            {hotkeyMenu({
              onQuery: handleQuery,
              removeHotkeyCharacter,
              onClose: handleClose,
            })}
          </Popover>
        )}
      </div>
    </>
  );
};

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputToolbar = ({
  className,
  ...props
}: PromptInputToolbarProps) => (
  <div
    className={cn("flex items-center justify-between p-1", className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps) => (
  <div
    className={cn(
      "flex items-center gap-1",
      // "[&_button:first-child]:rounded-bl-xl",
      className
    )}
    {...props}
  />
);

export type PromptInputButtonProps = ComponentProps<typeof Button>;

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  ...props
}: PromptInputButtonProps) => {
  const newSize =
    (size ?? Children.count(props.children) > 1) ? "default" : "icon";

  return (
    <Button
      className={cn(
        "shrink-0 gap-1.5 rounded-lg",
        variant === "ghost" && "text-muted-foreground",
        newSize === "default" && "px-3",
        className
      )}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  );
};

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
  <DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = ComponentProps<
  typeof Button
> & {};
export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps) => (
  <DropdownMenuTrigger asChild>
    <PromptInputButton className={className} {...props}>
      {children ?? <PlusIcon className="size-4" />}
    </PromptInputButton>
  </DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;
export const PromptInputActionMenuContent = ({
  className,
  ...props
}: PromptInputActionMenuContentProps) => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
);

export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;
export const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps) => (
  <DropdownMenuItem className={cn(className)} {...props} />
);

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <ArrowUp className="size-4" />;

  if (status === "submitted") {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === "streaming") {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <Button
      aria-label="Submit"
      className={cn("gap-1.5 rounded-lg", className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

export type PromptInputModelSelectProps = ComponentProps<typeof Select>;

export const PromptInputModelSelect = (props: PromptInputModelSelectProps) => (
  <Select {...props} />
);

export type PromptInputModelSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export const PromptInputModelSelectTrigger = ({
  className,
  ...props
}: PromptInputModelSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
      "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
      className
    )}
    {...props}
  />
);

export type PromptInputModelSelectContentProps = ComponentProps<
  typeof SelectContent
>;

export const PromptInputModelSelectContent = ({
  className,
  ...props
}: PromptInputModelSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
);

export type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputModelSelectItem = ({
  className,
  ...props
}: PromptInputModelSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);

export type PromptInputModelSelectValueProps = ComponentProps<
  typeof SelectValue
>;

export const PromptInputModelSelectValue = ({
  className,
  ...props
}: PromptInputModelSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);
