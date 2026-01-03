import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardNavigation } from "../useKeyboardNavigation";

describe("useKeyboardNavigation", () => {
  const mockItems = [
    { id: "item-1", name: "Item 1" },
    { id: "item-2", name: "Item 2" },
    { id: "item-3", name: "Item 3" },
  ];

  const mockGetItemId = (item: (typeof mockItems)[0]) => item.id;
  let mockOnSelect: ReturnType<typeof vi.fn> & ((id: string) => void);

  beforeEach(() => {
    mockOnSelect = vi.fn() as ReturnType<typeof vi.fn> & ((id: string) => void);
    vi.clearAllMocks();
  });

  const dispatchKeyDown = (key: string, target?: HTMLElement) => {
    // Create a div element to act as the default target (simulates document body)
    const defaultTarget = document.createElement("div");
    document.body.appendChild(defaultTarget);

    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });

    // Set the target
    Object.defineProperty(event, "target", {
      value: target || defaultTarget,
      writable: false,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    // Cleanup default target if we created one
    if (!target && defaultTarget.parentNode) {
      document.body.removeChild(defaultTarget);
    }
  };

  describe("ArrowDown navigation", () => {
    it("should navigate down on ArrowDown key", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      dispatchKeyDown("ArrowDown");
      expect(mockOnSelect).toHaveBeenCalledWith("item-2");
    });

    it("should navigate to next item from middle", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-2",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      dispatchKeyDown("ArrowDown");
      expect(mockOnSelect).toHaveBeenCalledWith("item-3");
    });

    it("should not navigate past the end", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-3",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      dispatchKeyDown("ArrowDown");
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe("ArrowUp navigation", () => {
    it("should navigate up on ArrowUp key", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-2",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      dispatchKeyDown("ArrowUp");
      expect(mockOnSelect).toHaveBeenCalledWith("item-1");
    });

    it("should not navigate past the beginning", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      dispatchKeyDown("ArrowUp");
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe("prependIds", () => {
    it("should include prepended IDs in navigation", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "prepend-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
          prependIds: ["prepend-1"],
        })
      );

      dispatchKeyDown("ArrowDown");
      expect(mockOnSelect).toHaveBeenCalledWith("item-1");
    });

    it("should navigate from item to prepended ID", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
          prependIds: ["prepend-1"],
        })
      );

      dispatchKeyDown("ArrowUp");
      expect(mockOnSelect).toHaveBeenCalledWith("prepend-1");
    });
  });

  describe("input field handling", () => {
    it("should not navigate when target is an input element", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      const input = document.createElement("input");
      document.body.appendChild(input);
      dispatchKeyDown("ArrowDown", input);

      expect(mockOnSelect).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it("should not navigate when target is a textarea", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      dispatchKeyDown("ArrowDown", textarea);

      expect(mockOnSelect).not.toHaveBeenCalled();
      document.body.removeChild(textarea);
    });

    it("should not navigate when target is a select", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      const select = document.createElement("select");
      document.body.appendChild(select);
      dispatchKeyDown("ArrowDown", select);

      expect(mockOnSelect).not.toHaveBeenCalled();
      document.body.removeChild(select);
    });

    it("should not navigate when target is inside a dialog", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      const button = document.createElement("button");
      dialog.appendChild(button);
      document.body.appendChild(dialog);

      dispatchKeyDown("ArrowDown", button);

      expect(mockOnSelect).not.toHaveBeenCalled();
      document.body.removeChild(dialog);
    });
  });

  describe("edge cases", () => {
    it("should not navigate on non-arrow keys", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      dispatchKeyDown("Enter");
      dispatchKeyDown("Space");
      dispatchKeyDown("Tab");

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("should handle empty items array", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: [],
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      dispatchKeyDown("ArrowDown");
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("should handle invalid selectedId", () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "non-existent",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      // When selectedId is not found, currentIndex will be -1
      // ArrowDown: Math.min(-1 + 1, 2) = 0, so it should select item-1
      dispatchKeyDown("ArrowDown");
      expect(mockOnSelect).toHaveBeenCalledWith("item-1");
    });
  });

  describe("cleanup", () => {
    it("should remove event listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          selectedId: "item-1",
          onSelect: mockOnSelect,
          getItemId: mockGetItemId,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
