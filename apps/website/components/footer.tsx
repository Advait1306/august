"use client";

import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { ThemeSwitcher } from "@/components/ui/shadcn-io/theme-switcher";

export function Footer() {
  const { setTheme, theme } = useTheme();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
      className="w-full flex flex-col sm:flex-row gap-6 sm:gap-0 justify-between items-start sm:items-center pt-12 border-t border-border/50"
    >
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 items-start sm:items-center">
        <span className="text-xs text-muted-foreground/70 tracking-wide">
          {new Date().getFullYear()} Sixhuman Technologies
        </span>
        <div className="flex gap-6 text-xs">
          <a
            href="/privacy-policy"
            className="text-muted-foreground/70 hover:text-foreground transition-colors duration-200"
          >
            Privacy
          </a>
          <a
            href="/terms-of-service"
            className="text-muted-foreground/70 hover:text-foreground transition-colors duration-200"
          >
            Terms
          </a>
        </div>
      </div>
      <ThemeSwitcher
        onChange={setTheme}
        value={theme as "light" | "dark" | "system"}
      />
    </motion.footer>
  );
}
