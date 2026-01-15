"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import DownloadButton from "@/components/download-button";
import { visitedPages } from "@/lib/visited-pages";

const features = [
  "Share skills across your team",
  "Connect to your applications",
  "Best agent-building practices",
  "Direct support from founders",
];

export default function PricingPage() {
  const isFirstVisit = !visitedPages.has("/pricing");
  const [shouldAnimate] = useState(isFirstVisit);

  useEffect(() => {
    visitedPages.add("/pricing");
  }, []);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-24">
      <div className="flex flex-col items-center text-center mb-16">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground mb-4">
          Simple pricing
        </h1>
        <p className="text-muted-foreground text-lg max-w-md">
          One plan, everything included. No hidden fees.
        </p>
      </div>

      <div className="flex flex-col items-center gap-12">
        {/* Platinum Card with 3D perspective */}
        <motion.div
          className="relative w-full max-w-md"
          style={{ perspective: '1000px' }}
          initial={{ opacity: shouldAnimate ? 0 : 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <motion.div
            className="relative w-full aspect-[1.6/1] rounded-2xl p-8 flex flex-col justify-between overflow-hidden bg-[linear-gradient(135deg,#e8e8e8_0%,#d4d4d4_25%,#f5f5f5_50%,#c9c9c9_75%,#e0e0e0_100%)] dark:bg-[linear-gradient(135deg,#3a3a3a_0%,#2a2a2a_25%,#4a4a4a_50%,#1f1f1f_75%,#333333_100%)] shadow-2xl"
            initial={{ rotateX: shouldAnimate ? 50 : 0, y: shouldAnimate ? 40 : 0 }}
            animate={{ rotateX: 0, y: 0 }}
            transition={{ duration: 0.9, delay: shouldAnimate ? 0.1 : 0, ease: [0.25, 0.4, 0.25, 1] }}
            style={{ transformStyle: 'preserve-3d', transformOrigin: 'center bottom' }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.4)_45%,rgba(255,255,255,0.6)_50%,rgba(255,255,255,0.4)_55%,transparent_60%)] dark:bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.1)_45%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.1)_55%,transparent_60%)]" />

            {/* Card content */}
            <div className="relative z-10">
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 tracking-wider uppercase">
                August
              </p>
            </div>

            <div className="relative z-10">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl sm:text-6xl font-semibold text-neutral-800 dark:text-neutral-100">
                  $35
                </span>
                <span className="text-neutral-600 dark:text-neutral-400 text-lg">
                  /seat/month
                </span>
              </div>
            </div>

            {/* Chip */}
            <div className="absolute top-8 right-8 w-12 h-9 rounded-md bg-[linear-gradient(135deg,#d4af37_0%,#f4e4a6_50%,#d4af37_100%)] dark:bg-[linear-gradient(135deg,#b8962e_0%,#d4c47a_50%,#b8962e_100%)]" />
          </motion.div>
        </motion.div>

        {/* Features */}
        <div>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-4">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                  <Check className="w-3 h-3 text-neutral-600 dark:text-neutral-400" />
                </div>
                <span className="text-muted-foreground text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex justify-center">
            <DownloadButton />
          </div>
        </div>
      </div>
    </div>
  );
}
