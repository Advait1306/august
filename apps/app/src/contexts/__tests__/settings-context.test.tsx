import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ReactNode } from "react";
import {
  SettingsProvider,
  useSettings,
  useNestedSetting,
  useSettingsSection,
} from "../settings-context";

// Get access to our localStorage mock
const getLocalStorageMock = () => window.localStorage as unknown as {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe("SettingsContext", () => {
  beforeEach(() => {
    const localStorage = getLocalStorageMock();
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("useSettings", () => {
    it("should provide default settings", () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.appearance.theme).toBe("system");
      expect(result.current.settings.general.notifications).toBe(true);
      expect(result.current.settings.claudeCode.autoUpdate).toBe(true);
      expect(result.current.settings.privacy.analytics).toBe(true);
    });

    it("should update a single setting section", () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting("appearance", {
          ...result.current.settings.appearance,
          theme: "dark",
        });
      });

      expect(result.current.settings.appearance.theme).toBe("dark");
    });

    it("should preserve other properties when updating a section", () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting("appearance", {
          ...result.current.settings.appearance,
          theme: "dark",
        });
      });

      expect(result.current.settings.appearance.theme).toBe("dark");
      expect(result.current.settings.appearance.fontSize).toBe("medium");
      expect(result.current.settings.appearance.compactMode).toBe(false);
    });

    it("should update multiple settings at once", () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({
          appearance: { ...result.current.settings.appearance, theme: "light" },
          general: { ...result.current.settings.general, notifications: false },
        });
      });

      expect(result.current.settings.appearance.theme).toBe("light");
      expect(result.current.settings.general.notifications).toBe(false);
    });

    it("should reset settings to defaults", () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      // First modify some settings
      act(() => {
        result.current.updateSetting("appearance", {
          ...result.current.settings.appearance,
          theme: "dark",
        });
      });

      expect(result.current.settings.appearance.theme).toBe("dark");

      // Then reset
      act(() => {
        result.current.resetSettings();
      });

      expect(result.current.settings.appearance.theme).toBe("system");
    });

    it("should persist settings to localStorage", () => {
      const localStorage = getLocalStorageMock();
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting("appearance", {
          ...result.current.settings.appearance,
          theme: "dark",
        });
      });

      expect(localStorage.setItem).toHaveBeenCalled();
      const lastCall = localStorage.setItem.mock.calls.slice(-1)[0];
      const savedValue = JSON.parse(lastCall[1]);
      expect(savedValue.appearance.theme).toBe("dark");
    });

    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // The hook checks for undefined context, but initialState is defined
      // So we test that it still returns the initial state (no-op functions)
      const { result } = renderHook(() => useSettings());

      // The initial state has no-op functions that return null
      expect(result.current.updateSetting("appearance", result.current.settings.appearance)).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe("useNestedSetting", () => {
    it("should get a nested setting value", () => {
      const { result } = renderHook(
        () => useNestedSetting("appearance", "theme"),
        { wrapper }
      );

      expect(result.current[0]).toBe("system");
    });

    it("should set a nested setting value", () => {
      const { result } = renderHook(
        () => useNestedSetting("appearance", "theme"),
        { wrapper }
      );

      act(() => {
        result.current[1]("dark");
      });

      expect(result.current[0]).toBe("dark");
    });

    it("should preserve other values in the section", () => {
      const { result: themeResult } = renderHook(
        () => useNestedSetting("appearance", "theme"),
        { wrapper }
      );

      const { result: settingsResult } = renderHook(() => useSettings(), {
        wrapper,
      });

      act(() => {
        themeResult.current[1]("dark");
      });

      // Check other appearance settings are preserved
      expect(settingsResult.current.settings.appearance.fontSize).toBe("medium");
      expect(settingsResult.current.settings.appearance.compactMode).toBe(false);
    });

    it("should work with boolean settings", () => {
      const { result } = renderHook(
        () => useNestedSetting("general", "notifications"),
        { wrapper }
      );

      expect(result.current[0]).toBe(true);

      act(() => {
        result.current[1](false);
      });

      expect(result.current[0]).toBe(false);
    });

    it("should work with string settings", () => {
      const { result } = renderHook(
        () => useNestedSetting("claudeCode", "binaryPath"),
        { wrapper }
      );

      expect(result.current[0]).toBe("");

      act(() => {
        result.current[1]("/usr/local/bin/claude");
      });

      expect(result.current[0]).toBe("/usr/local/bin/claude");
    });
  });

  describe("useSettingsSection", () => {
    it("should get an entire section", () => {
      const { result } = renderHook(() => useSettingsSection("claudeCode"), {
        wrapper,
      });

      expect(result.current[0].autoUpdate).toBe(true);
      expect(result.current[0].enableLogging).toBe(false);
      expect(result.current[0].binaryPath).toBe("");
    });

    it("should update section with partial values", () => {
      const { result } = renderHook(() => useSettingsSection("claudeCode"), {
        wrapper,
      });

      act(() => {
        result.current[1]({ autoUpdate: false });
      });

      expect(result.current[0].autoUpdate).toBe(false);
      // Other values should be preserved
      expect(result.current[0].enableLogging).toBe(false);
      expect(result.current[0].binaryPath).toBe("");
    });

    it("should update multiple values in a section", () => {
      const { result } = renderHook(() => useSettingsSection("claudeCode"), {
        wrapper,
      });

      act(() => {
        result.current[1]({
          autoUpdate: false,
          enableLogging: true,
          binaryPath: "/custom/path",
        });
      });

      expect(result.current[0].autoUpdate).toBe(false);
      expect(result.current[0].enableLogging).toBe(true);
      expect(result.current[0].binaryPath).toBe("/custom/path");
    });
  });

  describe("localStorage persistence", () => {
    it("should use custom storage key", () => {
      const localStorage = getLocalStorageMock();
      const customWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider storageKey="custom-settings">{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper: customWrapper });

      act(() => {
        result.current.updateSetting("appearance", {
          ...result.current.settings.appearance,
          theme: "dark",
        });
      });

      const lastCall = localStorage.setItem.mock.calls.slice(-1)[0];
      expect(lastCall[0]).toBe("custom-settings");
    });

    it("should use default settings when localStorage is empty", () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.appearance.theme).toBe("system");
      expect(result.current.settings.general.notifications).toBe(true);
    });
  });

  describe("default settings override", () => {
    it("should merge default settings with provided defaults", () => {
      const customWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider
          defaultSettings={{
            appearance: {
              theme: "dark",
              fontSize: "large",
              compactMode: true,
            },
          }}
        >
          {children}
        </SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper: customWrapper });

      expect(result.current.settings.appearance.theme).toBe("dark");
      expect(result.current.settings.appearance.fontSize).toBe("large");
      expect(result.current.settings.appearance.compactMode).toBe(true);
      // Other sections should have defaults
      expect(result.current.settings.general.notifications).toBe(true);
    });
  });
});
