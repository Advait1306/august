import { useEffect } from "react";

interface UseKeyboardNavigationProps<T> {
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  getItemId: (item: T) => string;
  prependIds?: string[];
}

export function useKeyboardNavigation<T>({
  items,
  selectedId,
  onSelect,
  getItemId,
  prependIds = [],
}: UseKeyboardNavigationProps<T>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

      // Skip navigation if typing in input fields or interacting with certain elements
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

      // Prevent default scrolling behavior
      e.preventDefault();

      // Build array of all selectable item IDs
      const allItemIds: Array<string> = [
        ...prependIds,
        ...(items || []).map(getItemId),
      ];

      // Don't navigate if there are no items
      if (allItemIds.length === 0) return;

      // Find current index
      const currentIndex = allItemIds.indexOf(selectedId);

      // Calculate next index (without wrap-around)
      let nextIndex = currentIndex;
      if (e.key === "ArrowDown") {
        nextIndex = Math.min(currentIndex + 1, allItemIds.length - 1);
      } else {
        nextIndex = Math.max(currentIndex - 1, 0);
      }

      // Only update if index changed and next index is valid
      if (nextIndex !== currentIndex && allItemIds[nextIndex]) {
        onSelect(allItemIds[nextIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedId, onSelect, getItemId, prependIds]);
}
