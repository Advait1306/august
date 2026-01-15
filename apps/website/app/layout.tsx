import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@/components/analytics";
import { ClerkProvider } from "@clerk/nextjs";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "August",
  description: "Artificial helpers for your team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider waitlistUrl="/waitlist">
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <Analytics>
            <ThemeProvider attribute="class">
              <div className="font-sans min-h-screen flex flex-col">
                {/* Subtle grain texture overlay */}
                <div
                  className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03] z-50"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                  }}
                />

                {/* Header - constrained width */}
                <div className="relative w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12 pt-8 sm:pt-12">
                  <Header />
                </div>

                {/* Main content - full width for full-bleed sections */}
                <main className="flex-1">{children}</main>

                {/* Footer - constrained width */}
                <div className="relative w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12 pb-8 sm:pb-12">
                  <Footer />
                </div>
              </div>
            </ThemeProvider>
          </Analytics>
        </body>
      </html>
    </ClerkProvider>
  );
}
