/**
 * Settings Context
 *
 * Provides a type-safe settings store with localStorage persistence.
 *
 * ## Usage Overview
 *
 * There are 3 ways to access settings, depending on your needs:
 *
 * 1. **useNestedSetting** - Most convenient for single settings
 *    ```tsx
 *    const [binaryPath, setBinaryPath] = useNestedSetting("claudeCode", "binaryPath");
 *    ```
 *
 * 2. **useSettingsSection** - Best for multiple settings in the same section
 *    ```tsx
 *    const [claudeCode, updateClaudeCode] = useSettingsSection("claudeCode");
 *    updateClaudeCode({ binaryPath: "/path", autoUpdate: true });
 *    ```
 *
 * 3. **useSettings** - Full control over all settings
 *    ```tsx
 *    const { settings, updateSettings, resetSettings } = useSettings();
 *    ```
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface ClaudeInstallation {
  path: string;
  version?: string;
  source: string;
  installationType: "system" | "custom";
}

/**
 * Application settings organized into logical sections.
 * All settings are persisted to localStorage automatically.
 */
export type Settings = {
  general: {
    language: string;
    notifications: boolean;
  };
  appearance: {
    theme: "dark" | "light" | "system";
    fontSize: "small" | "medium" | "large";
    compactMode: boolean;
  };
  claudeCode: {
    binaryPath: string;
    selectedInstallation?: ClaudeInstallation;
    autoUpdate: boolean;
    enableLogging: boolean;
  };
  privacy: {
    analytics: boolean;
    crashReporting: boolean;
  };
  experimental: {
    enableExperimentalFeatures: boolean;
  };
};

type SettingsProviderProps = {
  children: ReactNode;
  defaultSettings?: Partial<Settings>;
  storageKey?: string;
};

type SettingsProviderState = {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
};

const defaultSettingsValues: Settings = {
  general: {
    language: "en",
    notifications: true,
  },
  appearance: {
    theme: "system",
    fontSize: "medium",
    compactMode: false,
  },
  claudeCode: {
    binaryPath: "",
    selectedInstallation: undefined,
    autoUpdate: true,
    enableLogging: false,
  },
  privacy: {
    analytics: true,
    crashReporting: true,
  },
  experimental: {
    enableExperimentalFeatures: false,
  },
};

const initialState: SettingsProviderState = {
  settings: defaultSettingsValues,
  updateSetting: () => null,
  updateSettings: () => null,
  resetSettings: () => null,
};

const SettingsProviderContext =
  createContext<SettingsProviderState>(initialState);

/**
 * Settings Provider Component
 *
 * Wrap your application with this provider to enable settings management.
 * Settings are automatically persisted to localStorage.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <SettingsProvider>
 *       <YourApp />
 *     </SettingsProvider>
 *   );
 * }
 * ```
 */
export function SettingsProvider({
  children,
  defaultSettings = {},
  storageKey = "august-settings",
  ...props
}: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const item = localStorage.getItem(storageKey);
      if (item) {
        const parsed = JSON.parse(item);
        return { ...defaultSettingsValues, ...defaultSettings, ...parsed };
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
    }
    return { ...defaultSettingsValues, ...defaultSettings };
  });

  // Persist to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }, [settings, storageKey]);

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...defaultSettingsValues, ...defaultSettings });
  }, [defaultSettings]);

  const value = useMemo(
    () => ({
      settings,
      updateSetting,
      updateSettings,
      resetSettings,
    }),
    [settings, updateSetting, updateSettings, resetSettings]
  );

  return (
    <SettingsProviderContext.Provider {...props} value={value}>
      {children}
    </SettingsProviderContext.Provider>
  );
}

/**
 * Access all settings and update functions.
 * Use this when you need full control over settings or want to update multiple settings at once.
 *
 * @example
 * ```tsx
 * function SettingsMenu() {
 *   const { settings, updateSettings, resetSettings } = useSettings();
 *
 *   return (
 *     <div>
 *       <p>Path: {settings.claudeCode.binaryPath}</p>
 *       <Button onClick={resetSettings}>Reset All</Button>
 *       <Button onClick={() => updateSettings({
 *         claudeCode: { ...settings.claudeCode, autoUpdate: false }
 *       })}>
 *         Disable Auto Update
 *       </Button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useSettings = () => {
  const context = useContext(SettingsProviderContext);

  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }

  return context;
};

/**
 * Access a specific nested setting within a section.
 * This is the most convenient hook for accessing individual settings.
 * Returns a tuple of [value, setValue].
 *
 * @example
 * ```tsx
 * function ClaudeCodeSettings() {
 *   const [binaryPath, setBinaryPath] = useNestedSetting("claudeCode", "binaryPath");
 *   const [autoUpdate, setAutoUpdate] = useNestedSetting("claudeCode", "autoUpdate");
 *
 *   return (
 *     <div>
 *       <input
 *         type="text"
 *         value={binaryPath}
 *         onChange={(e) => setBinaryPath(e.target.value)}
 *         placeholder="/path/to/claude-code"
 *       />
 *       <Toggle
 *         checked={autoUpdate}
 *         onChange={(checked) => setAutoUpdate(checked)}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export const useNestedSetting = <
  K extends keyof Settings,
  NK extends keyof Settings[K],
>(
  section: K,
  key: NK
) => {
  const { settings, updateSetting } = useSettings();

  const setValue = useCallback(
    (value: Settings[K][NK]) => {
      updateSetting(section, {
        ...settings[section],
        [key]: value,
      });
    },
    [section, key, settings, updateSetting]
  );

  return [settings[section][key], setValue] as const;
};

/**
 * Access an entire settings section with a partial update function.
 * Use this when you want to work with multiple settings in the same section.
 * Returns a tuple of [sectionValue, updateSection].
 *
 * @example
 * ```tsx
 * function ClaudeCodePanel() {
 *   const [claudeCode, updateClaudeCode] = useSettingsSection("claudeCode");
 *
 *   return (
 *     <div>
 *       <input
 *         value={claudeCode.binaryPath}
 *         onChange={(e) => updateClaudeCode({ binaryPath: e.target.value })}
 *       />
 *       <Toggle
 *         checked={claudeCode.autoUpdate}
 *         onChange={(checked) => updateClaudeCode({ autoUpdate: checked })}
 *       />
 *       <Toggle
 *         checked={claudeCode.enableLogging}
 *         onChange={(checked) => updateClaudeCode({ enableLogging: checked })}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export const useSettingsSection = <K extends keyof Settings>(section: K) => {
  const { settings, updateSetting } = useSettings();

  const updateSection = useCallback(
    (value: Partial<Settings[K]>) => {
      updateSetting(section, {
        ...settings[section],
        ...value,
      });
    },
    [section, settings, updateSetting]
  );

  return [settings[section], updateSection] as const;
};
