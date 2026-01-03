import { useCallback, useMemo, useState } from "react";
import type { SelectedSkill } from "@/src/contexts/task-runtime";

export interface MentionMatch {
  start: number;
  end: number;
  name: string;
  id: string;
}

interface UseMentionProps {
  options: SelectedSkill[];
  selectedMentions: SelectedSkill[];
  onSelectedMentionsChange: (mentions: SelectedSkill[]) => void;
  inputValue: string;
  onInputValueChange: (value: string) => void;
  trigger?: string;
}

interface UseMentionReturn {
  isOpen: boolean;
  triggerIndex: number | null;
  searchQuery: string;
  filteredOptions: SelectedSkill[];
  matches: MentionMatch[];
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  selectOption: (option: SelectedSkill) => void;
  close: () => void;
}

export function useMention({
  options,
  selectedMentions,
  onSelectedMentionsChange,
  inputValue,
  onInputValueChange,
  trigger = "@",
}: UseMentionProps): UseMentionReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerIndex, setTriggerIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Find all @mentions in the text that match selected options
  const matches = useMemo<MentionMatch[]>(() => {
    if (!inputValue || selectedMentions.length === 0) return [];

    const mentionPattern = buildMentionPattern(trigger, selectedMentions);
    if (!mentionPattern) return [];

    const result: MentionMatch[] = [];
    let match: RegExpExecArray | null;
    while ((match = mentionPattern.exec(inputValue)) !== null) {
      const name = match[1];
      const mention = selectedMentions.find((m) => m.name === name);
      if (mention) {
        result.push({
          start: match.index,
          end: match.index + match[0].length,
          name: mention.name,
          id: mention.id,
        });
      }
    }

    return result;
  }, [inputValue, selectedMentions, trigger]);

  // Filter options based on search query, excluding already selected
  const filteredOptions = useMemo(() => {
    const selectedIds = new Set(selectedMentions.map((m) => m.id));
    const available = options.filter((o) => !selectedIds.has(o.id));

    if (!searchQuery) return available;

    const query = searchQuery.toLowerCase();
    return available.filter(
      (o) =>
        o.name.toLowerCase().includes(query) ||
        o.description?.toLowerCase().includes(query)
    );
  }, [options, selectedMentions, searchQuery]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart;

      onInputValueChange(newValue);

      // Check if we should open/close the menu
      if (triggerIndex !== null) {
        // We're in mention mode, update search query
        if (cursorPos <= triggerIndex) {
          // Cursor moved before trigger, close menu
          setIsOpen(false);
          setTriggerIndex(null);
          setSearchQuery("");
        } else {
          // Update search query
          const query = newValue.slice(triggerIndex + 1, cursorPos);
          // If query contains space or trigger was deleted, close
          if (query.includes(" ") || newValue[triggerIndex] !== trigger) {
            setIsOpen(false);
            setTriggerIndex(null);
            setSearchQuery("");
          } else {
            setSearchQuery(query);
          }
        }
      } else {
        // Check if trigger was just typed
        const charBeforeCursor = newValue[cursorPos - 1];
        if (charBeforeCursor === trigger) {
          // Check if it's at start or after whitespace
          const charBeforeTrigger = newValue[cursorPos - 2];
          if (
            cursorPos === 1 ||
            charBeforeTrigger === " " ||
            charBeforeTrigger === "\n"
          ) {
            setIsOpen(true);
            setTriggerIndex(cursorPos - 1);
            setSearchQuery("");
          }
        }
      }

      // Check if any existing mentions were deleted
      const currentMentionNames = new Set<string>();
      const mentionPattern = buildMentionPattern(trigger, selectedMentions);
      if (mentionPattern) {
        let match: RegExpExecArray | null;
        while ((match = mentionPattern.exec(newValue)) !== null) {
          currentMentionNames.add(match[1]);
        }
      }

      const remainingMentions = selectedMentions.filter((m) =>
        currentMentionNames.has(m.name)
      );
      if (remainingMentions.length !== selectedMentions.length) {
        onSelectedMentionsChange(remainingMentions);
      }
    },
    [
      triggerIndex,
      trigger,
      selectedMentions,
      onInputValueChange,
      onSelectedMentionsChange,
    ]
  );

  const selectOption = useCallback(
    (option: SelectedSkill) => {
      if (triggerIndex === null) return;

      // Insert the mention at the trigger position
      const beforeTrigger = inputValue.slice(0, triggerIndex);
      const afterCursor = inputValue.slice(triggerIndex + 1 + searchQuery.length);
      const mentionText = `${trigger}${option.name}`;
      const newValue = `${beforeTrigger}${mentionText} ${afterCursor}`;

      onInputValueChange(newValue);
      onSelectedMentionsChange([...selectedMentions, option]);

      setIsOpen(false);
      setTriggerIndex(null);
      setSearchQuery("");
    },
    [
      triggerIndex,
      inputValue,
      searchQuery,
      trigger,
      selectedMentions,
      onInputValueChange,
      onSelectedMentionsChange,
    ]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setTriggerIndex(null);
    setSearchQuery("");
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [isOpen, close]
  );

  return {
    isOpen,
    triggerIndex,
    searchQuery,
    filteredOptions,
    matches,
    onKeyDown,
    onInputChange,
    selectOption,
    close,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regex pattern to match mentions in text
 */
function buildMentionPattern(
  trigger: string,
  mentions: SelectedSkill[]
): RegExp | null {
  const validMentions = mentions.filter((m) => m.name);
  if (validMentions.length === 0) return null;

  return new RegExp(
    `${trigger}(${validMentions.map((m) => escapeRegExp(m.name)).join("|")})(?=\\s|$)`,
    "g"
  );
}
