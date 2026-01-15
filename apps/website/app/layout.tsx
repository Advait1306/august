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
  description: "Agent native software development infrastructure",
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
                {/* Header - constrained width */}
                <div className="relative w-full max-w-[840px] mx-auto px-10 sm:px-8 lg:px-12 pt-8 sm:pt-12">
                  <Header />
                </div>

                {/* Main content - full width for full-bleed sections */}
                <main className="flex-1">{children}</main>

                {/* Footer - constrained width */}
                <div className="relative w-full max-w-[840px] mx-auto px-10 sm:px-8 lg:px-12 pb-8 sm:pb-12">
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
