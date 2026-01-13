"use client";

import DownloadButton from "@/components/download-button";
import GettingStarted from "@/components/getting-started";
import { ThemeSwitcher } from "@/components/ui/shadcn-io/theme-switcher";
import { useTheme } from "next-themes";
import Image from "next/image";

export default function Home() {
  const { setTheme, theme } = useTheme();
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <header className="w-full flex flex-row items-center justify-between max-w-[1500px] mx-auto">
        <Image
          src="/icon.svg"
          width={32}
          height={32}
          alt="August"
          className="rounded"
        />
        <div className="flex items-center gap-4">
          <a
            href="/waitlist"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Join Waitlist
          </a>
          <DownloadButton />
        </div>
      </header>
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start w-full max-w-[1500px]">
        <div className="flex flex-col gap-2">
          <span className="w-full text-4xl font-medium tracking-tight">
            Artificial helpers for your team
          </span>
          <span className="text-muted-foreground md:w-[60%]">
            Create, manage, and deploy agents for your company, allowing you to
            focus on decision-making while your agents handle execution.
          </span>
        </div>

        <Image
          src={"/hero_dark.png"}
          priority
          width={1600}
          height={1000}
          alt="Hero"
          className="shadow border rounded-[4px] md:rounded-[12px] hidden dark:block"
        />
        <Image
          src={"/hero_light.png"}
          priority
          width={1600}
          height={1000}
          alt="Hero"
          className="shadow border rounded-[4px] md:rounded-[12px] dark:hidden"
        />
        <hr />
        <span className="w-full text-2xl font-medium tracking-tight">
          Getting started
        </span>

        <GettingStarted />
      </main>
      <footer className="w-full max-w-[1500px] row-start-3 flex gap-[24px] flex-wrap justify-between items-center">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center">
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} sixhuman technologies private limited
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
