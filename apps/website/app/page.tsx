"use client";

import GettingStarted from "@/components/getting-started";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ui/shadcn-io/theme-switcher";
import { useTheme } from "next-themes";
import Image from "next/image";

export default function Home() {
  const { setTheme } = useTheme();
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <header className="w-full flex flex-row items-center justify-between max-w-[1100px] mx-auto">
        <Image
          src="/icon.svg"
          width={32}
          height={32}
          alt="August"
          className="rounded"
        />
        <Button
          onClick={() => {
            window.location.href =
              "https://github.com/sixhuman/august-shell-release/releases";
          }}
        >
          Download now
        </Button>
      </header>
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start max-w-[1100px]">
        <div className="flex flex-col gap-2">
          <span className="w-full text-4xl font-medium tracking-tight">
            Artificial employees for your team
          </span>
          <span className="text-muted-foreground md:w-[60%]">
            Create, manage, and deploy agents for your company, allowing you to
            focus on research and decision-making while your agents handle
            execution.
          </span>
        </div>

        <Image
          src={"/hero_dark.png"}
          priority
          width={1200}
          height={400}
          alt="Hero"
          className="shadow border rounded hidden dark:block"
        />
        <Image
          src={"/hero_light.png"}
          priority
          width={1200}
          height={400}
          alt="Hero"
          className="shadow border rounded dark:hidden"
        />
        <hr />
        <span className="w-full text-2xl font-medium tracking-tight">
          Getting started
        </span>

        <GettingStarted />
      </main>
      <footer className="w-full max-w-[1100px] row-start-3 flex gap-[24px] flex-wrap justify-between items-center">
        <span className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} sixhuman technologies private limited
        </span>
        <ThemeSwitcher onChange={setTheme} />
      </footer>
    </div>
  );
}
