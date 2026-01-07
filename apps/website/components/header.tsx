"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import DownloadButton from "@/components/download-button";
import { visitedPages } from "@/lib/visited-pages";

export function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  const isFirstVisit = !visitedPages.has(pathname);
  const [shouldAnimate] = useState(isFirstVisit);

  useEffect(() => {
    visitedPages.add(pathname);
  }, [pathname]);

  return (
    <motion.header
      initial={{ opacity: shouldAnimate ? 0 : 1 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.5,
        delay: shouldAnimate && isHomePage ? 1.1 : 0,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className="w-full flex flex-row items-center justify-between"
    >
      <Link href="/" className="flex items-center gap-3 group">
        <Image
          src="/icon.svg"
          width={28}
          height={28}
          alt="August"
          className="rounded transition-transform duration-300 group-hover:scale-105"
        />
        <span className="font-medium text-foreground/90 tracking-tight hidden sm:inline">
          August
        </span>
      </Link>

      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-8">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          Product
        </Link>
        <Link
          href="/#features"
          scroll={true}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          Features
        </Link>
        <Link
          href="/letters"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          Letters
        </Link>
        <Link
          href="/pricing"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          Pricing
        </Link>
      </nav>

      <DownloadButton />
    </motion.header>
  );
}
