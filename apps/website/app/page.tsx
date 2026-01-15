"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

const providers = [
  { name: "OpenAI", logo: "/logos/openai.svg" },
  { name: "Anthropic", logo: "/logos/anthropic.svg" },
  { name: "Google", logo: "/logos/google.svg" },
];

const environments = [
  { name: "macOS", logo: "/logos/macos.svg", size: 20 },
  { name: "Linux", logo: "/logos/linux.svg", size: 20 },
  { name: "Windows", logo: "/logos/windows.svg", size: 16 },
];

export default function Home() {
  const [showProviders, setShowProviders] = useState(false);
  const [showEnvironments, setShowEnvironments] = useState(false);
  const [email, setEmail] = useState("");
  const [waitlistState, setWaitlistState] = useState<{ status: null } | { status: "waitlist" } | { status: "entered"; email: string } | { status: "loading" } | { status: "error" }>({ status: null });
  const clerk = useClerk();

  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const waitlistCookie = cookies.find((c) => c.startsWith("waitlist_email="));
    if (waitlistCookie) {
      setWaitlistState({ status: "entered", email: decodeURIComponent(waitlistCookie.substring("waitlist_email=".length)) });
    } else {
      setWaitlistState({ status: "waitlist" });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setWaitlistState({ status: "loading" });
    try {
      await clerk.joinWaitlist({ emailAddress: email });
      document.cookie = `waitlist_email=${encodeURIComponent(email)}; max-age=${60 * 60 * 24 * 365}; path=/; Secure; SameSite=Strict`;
      setWaitlistState({ status: "entered", email });
      setEmail("");
    } catch {
      setWaitlistState({ status: "error" });
    }
  };

  return (
    <div className="flex flex-col">
      <section className="w-full max-w-[800px] mx-auto px-10 sm:px-8 lg:px-12 py-16 sm:py-24">
        <div className="flex flex-col gap-12">
          {/* Narrative */}
          <div className="flex flex-col gap-6 text-base sm:text-lg leading-relaxed text-muted-foreground">
            <p>
              You started with an AI IDE and realized it could navigate and
              extend your codebase. Impressive, but familiar.
            </p>
            <p>
              Then you tried Claude Code. You were skeptical, an autonomous agent
              running in your terminal felt like a leap. But you gave it a shot,
              and it clicked in a way you didn&apos;t expect.
            </p>
            <p>
              Now you&apos;re running multiple instances, upgrading plans to keep
              up, spinning up worktrees to parallelize the work. What started as
              an experiment has become your default.
            </p>
            <p>
              Soon, you&apos;ll need new infrastructure to match your speed of
              working. August is bringing it all together.
            </p>
          </div>

          {/* Features list */}
          <ul className="flex flex-col gap-5 text-base sm:text-lg leading-relaxed text-muted-foreground list-disc">
            <li>
              <span className="font-medium text-foreground">
                Agent orchestration
              </span>{" "}
              using your{" "}
              <motion.span
                className="relative inline-block underline underline-offset-4 decoration-muted-foreground/50 cursor-pointer"
                onMouseEnter={() => setShowProviders(true)}
                onMouseLeave={() => setShowProviders(false)}
                onTap={() => setShowProviders((prev) => !prev)}
              >
                preferred provider
                <AnimatePresence>
                  {showProviders && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-full left-0 mb-2 flex items-center gap-2"
                    >
                      {providers.map((provider, index) => (
                        <motion.div
                          key={provider.name}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.3,
                            delay: index * 0.05,
                            ease: [0.25, 0.4, 0.25, 1],
                          }}
                          className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center"
                        >
                          <Image
                            src={provider.logo}
                            alt={provider.name}
                            width={20}
                            height={20}
                            className="dark:invert"
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.span>
            </li>
            <li>
              <span className="font-medium text-foreground">Skills</span> reflecting your organization&apos;s taste
            </li>
            <li>
              <span className="font-medium text-foreground">Memory</span> that
              learns how you build
            </li>
            <li>
              <motion.span
                className="relative inline-block font-medium text-foreground underline underline-offset-4 decoration-muted-foreground/50 cursor-pointer"
                onMouseEnter={() => setShowEnvironments(true)}
                onMouseLeave={() => setShowEnvironments(false)}
                onTap={() => setShowEnvironments((prev) => !prev)}
              >
                Environments
                <AnimatePresence>
                  {showEnvironments && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-full left-0 mb-2 flex items-center gap-2"
                    >
                      {environments.map((env, index) => (
                        <motion.div
                          key={env.name}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.3,
                            delay: index * 0.05,
                            ease: [0.25, 0.4, 0.25, 1],
                          }}
                          className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center"
                        >
                          <Image
                            src={env.logo}
                            alt={env.name}
                            width={env.size}
                            height={env.size}
                            className="dark:invert"
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.span>{" "}
              that are sandboxed, reproducible & verifiable
            </li>
          </ul>

          {/* Waitlist form */}
          {waitlistState.status !== null && (
            <div className="flex flex-col gap-4 pt-8 border-t border-border">
              {waitlistState.status === "entered" ? (
                <p className="text-muted-foreground">
                  You&apos;re on the waitlist with{" "}
                  <span className="text-foreground">{waitlistState.email}</span>
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    Join the waitlist for early access.
                  </p>
                  <form onSubmit={handleSubmit} className="flex gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="woz@apple.com"
                      required
                      className="flex-1 px-4 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                    <button
                      type="submit"
                      disabled={waitlistState.status === "loading"}
                      className="w-16 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
                    >
                      {waitlistState.status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
                    </button>
                  </form>
                  {waitlistState.status === "error" && (
                    <p className="text-sm text-red-500">
                      Something went wrong. Please try again.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
