"use client";

import { useEffect, type ReactNode } from "react";
import { useNestedSetting } from "../contexts/settings-context";

type ThemeProps = {
  children: ReactNode;
};

export function Theme({ children }: ThemeProps) {
  const [theme] = useNestedSetting("appearance", "theme");

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

      // Adding handler to automatically change theme when system theme changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      const handleChange = () => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");

        const systemTheme = mediaQuery.matches ? "dark" : "light";
        root.classList.add(systemTheme);
      };

      mediaQuery.addEventListener("change", handleChange);

      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    root.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
