import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "../contexts/theme-context";
import { CommandMenuProvider } from "@/components/command-menu";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-react";
import Guard from "../../components/guard";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { getSerwist } from "virtual:serwist";

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const SIGN_IN_URL = import.meta.env.VITE_CLERK_SIGN_IN_URL;
const SIGN_UP_URL = import.meta.env.VITE_CLERK_SIGN_UP_URL;

if (!PUBLISHABLE_KEY) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

const RootLayout = () => {
  useEffect(() => {
    const loadSerwist = async () => {
      if ("serviceWorker" in navigator) {
        const serwist = await getSerwist();
        serwist?.addEventListener("installed", () => {
          console.log("Serwist installed!");
        });
        void serwist?.register();
      }
    };
    loadSerwist();
  }, []);

  if (window.electron) {
    return (
      <>
        <ThemeProvider>
          <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            signInUrl={SIGN_IN_URL}
            signUpUrl={SIGN_UP_URL}
          >
            <SignedIn>
              <CommandMenuProvider>
                <div className="[--header-height:calc(--spacing(9))]">
                  <SidebarProvider className="flex flex-col">
                    <SiteHeader />
                    <div className="flex flex-1 overflow-hidden">
                      <AppSidebar />
                      <SidebarInset>
                        <div className="rounded-lg border overflow-hidden flex-1 bg-background">
                          <Outlet />
                        </div>
                      </SidebarInset>
                    </div>
                  </SidebarProvider>
                </div>
              </CommandMenuProvider>
            </SignedIn>
            <SignedOut>
              <Guard />
            </SignedOut>
          </ClerkProvider>
        </ThemeProvider>
        <TanStackRouterDevtools />
        <Toaster />
      </>
    );
  } else {
    return (
      <>
        <ThemeProvider>
          <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            signInUrl={SIGN_IN_URL}
            signUpUrl={SIGN_UP_URL}
          >
            <Outlet />
          </ClerkProvider>
        </ThemeProvider>
        <TanStackRouterDevtools />
        <Toaster />
      </>
    );
  }
};

export const Route = createRootRoute({ component: RootLayout });
