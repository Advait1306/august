"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { visitedPages } from "@/lib/visited-pages";

export default function Home() {
  const isFirstVisit = !visitedPages.has("/");
  const [shouldAnimate] = useState(isFirstVisit);

  useEffect(() => {
    visitedPages.add("/");
  }, []);

  return (
    <div className="flex flex-col">
      {/* Hero Section - constrained width, full height on mobile */}
      <section className="w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-24 min-h-dvh sm:min-h-0 flex flex-col justify-center">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5 max-w-2xl">
            <motion.h1
              initial={{ opacity: shouldAnimate ? 0 : 1 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.6,
                delay: shouldAnimate ? 0 : 0,
                ease: [0.25, 0.4, 0.25, 1],
              }}
              className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.1] text-foreground"
            >
              Artificial helpers
              <br />
              <span className="text-muted-foreground/80">for your team</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: shouldAnimate ? 0 : 1 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.6,
                delay: shouldAnimate ? 0.7 : 0,
                ease: [0.25, 0.4, 0.25, 1],
              }}
              className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl"
            >
              Create, manage, and deploy agents for your company. Focus on
              decision-making while your agents handle execution.
            </motion.p>
          </div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: shouldAnimate ? 0 : 1 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.7,
              delay: shouldAnimate ? 0.9 : 0,
              ease: [0.25, 0.4, 0.25, 1],
            }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-b from-primary/5 to-transparent rounded-3xl blur-2xl dark:from-primary/10" />
            <div className="relative">
              <Image
                src="/hero_dark.png"
                priority
                width={1600}
                height={1000}
                alt="August dashboard showing AI agents managing tasks"
                className="shadow-lg border border-border/50 rounded-lg sm:rounded-xl hidden dark:block"
              />
              <Image
                src="/hero_light.png"
                priority
                width={1600}
                height={1000}
                alt="August dashboard showing AI agents managing tasks"
                className="shadow-lg border border-border/50 rounded-lg sm:rounded-xl dark:hidden"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature 1: Share skills across your team - Full bleed */}
      <section id="features" className="relative w-full py-24 sm:py-32 bg-[linear-gradient(to_bottom,rgb(229,229,229)_0%,transparent_40%)] dark:bg-[linear-gradient(to_bottom,rgb(38,38,38)_0%,transparent_40%)]">
        <div className="w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 max-w-xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground leading-[1.1]">
                Share skills across your team
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
                Your AI agents improve faster when they learn from everyone.
                Share prompts, workflows, and knowledge across your entire
                organization.
              </p>
            </div>
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 dark:from-primary/10 dark:via-primary/15 dark:to-primary/10">
              <Image
                src="/features/share-skills.png"
                alt="Share skills across your team"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Connect to your applications - Full bleed */}
      <section className="relative w-full py-24 sm:py-32 bg-[linear-gradient(to_bottom,rgb(229,229,229)_0%,transparent_40%)] dark:bg-[linear-gradient(to_bottom,rgb(38,38,38)_0%,transparent_40%)]">
        <div className="w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 max-w-xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground leading-[1.1]">
                Connect to your applications
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
                Integrate with the tools your team already uses. Your agents
                work where you work.
              </p>
            </div>
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 dark:from-primary/10 dark:via-primary/15 dark:to-primary/10">
              <Image
                src="/features/connect-apps.png"
                alt="Connect to your applications"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3 & 4: 1x2 Grid - Full bleed */}
      <section className="relative w-full py-24 sm:py-32 bg-[linear-gradient(to_bottom,rgb(229,229,229)_0%,transparent_40%)] dark:bg-[linear-gradient(to_bottom,rgb(38,38,38)_0%,transparent_40%)]">
        <div className="w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* Best agent-building practices */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground">
                  Best agent-building practices
                </h3>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
                  Access proven skills, workflows, and memory patterns. We stay
                  up to date with AI research so you don&apos;t have to.
                </p>
              </div>
              <div className="relative flex-1 min-h-[240px] sm:min-h-[320px] overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 dark:from-primary/10 dark:via-primary/15 dark:to-primary/10">
                <Image
                  src="/features/best-practices.png"
                  alt="Best agent-building practices"
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Direct support from founders */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground">
                  Direct support from founders
                </h3>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
                  Get help when you need it. Our founders are directly available
                  to help you get the most out of August.
                </p>
              </div>
              <div className="relative flex-1 min-h-[240px] sm:min-h-[320px] overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 dark:from-primary/10 dark:via-primary/15 dark:to-primary/10">
                <Image
                  src="/features/founder-support.png"
                  alt="Direct support from founders"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
