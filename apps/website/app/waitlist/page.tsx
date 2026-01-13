"use client";

import { Waitlist } from "@clerk/nextjs";
import { ThemeSwitcher } from "@/components/ui/shadcn-io/theme-switcher";
import { useTheme } from "next-themes";
import Image from "next/image";

export default function WaitlistPage() {
  const { setTheme, theme } = useTheme();

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <header className="w-full flex flex-row items-center justify-between max-w-[1500px] mx-auto">
        <a href="/">
          <Image
            src="/icon.svg"
            width={32}
            height={32}
            alt="August"
            className="rounded"
          />
        </a>
        <a
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to home
        </a>
      </header>

      <main className="flex flex-col gap-8 row-start-2 items-center w-full max-w-[500px]">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-4xl font-medium tracking-tight">
            Join the Waitlist
          </span>
          <span className="text-muted-foreground">
            Be among the first to experience August. We&apos;ll notify you when
            your access is ready.
          </span>
        </div>

        <Waitlist />
      </main>

      <footer className="w-full max-w-[1500px] row-start-3 flex gap-[24px] flex-wrap justify-between items-center">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center">
          <span className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} sixhuman technologies private
            limited
          </span>
          <div className="flex gap-4 text-sm">
            <a
              href="/privacy-policy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="/terms-of-service"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
        <ThemeSwitcher
          onChange={setTheme}
          value={theme as "light" | "dark" | "system"}
        />
      </footer>
    </div>
  );
}
