"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNestedSetting } from "../contexts/settings-context";

type ResolvedTheme = "light" | "dark";

type ThemeContextType = {
  resolvedTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme] = useNestedSetting("appearance", "theme");
  
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    // Initialize with current theme
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme as ResolvedTheme;
  });

  // Handle theme changes and apply to DOM
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      setResolvedTheme(systemTheme);

      // Adding handler to automatically change theme when system theme changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      const handleChange = () => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");

        const systemTheme = mediaQuery.matches ? "dark" : "light";
        root.classList.add(systemTheme);
        setResolvedTheme(systemTheme);
      };

      mediaQuery.addEventListener("change", handleChange);

      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    root.classList.add(theme);
    setResolvedTheme(theme as ResolvedTheme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ResolvedTheme {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context.resolvedTheme;
}

// Backward compatibility export
export const Theme = ThemeProvider;
