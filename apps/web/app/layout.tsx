"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/page-1");
    router.prefetch("/page-2");
    router.prefetch("/page-3");
    router.prefetch("/page-4");
    router.prefetch("/page-5");
    router.prefetch("/page-6");
    router.prefetch("/page-7");
    router.prefetch("/page-8");
    router.prefetch("/page-9");
    router.prefetch("/page-10");
  }, [router]);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
