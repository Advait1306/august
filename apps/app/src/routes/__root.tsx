import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Theme } from "@/src/components/theme";
import { SettingsProvider } from "@/src/contexts/settings-context";
import { CommandMenuProvider } from "@/components/command-menu";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-react";
import Guard from "@/components/guard";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { shadcn } from "@clerk/themes";
import { getSerwist } from "virtual:serwist";
import { UpdateProvider } from "@/src/contexts/update-context";
import { UpdateToast } from "@/components/update-toast";
import { SyncEngine } from "../components/sync_engine";
import { TaskRuntimeProvider } from "@/src/contexts/task-runtime";
import { Analytics } from "@/src/components/analytics";

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
    // Web app is running in electron shell,
    // show all functionality.
    return (
      <>
        <SettingsProvider>
          <Theme>
            <UpdateProvider>
              <ClerkProvider
                publishableKey={PUBLISHABLE_KEY}
                signInUrl={SIGN_IN_URL}
                signUpUrl={SIGN_UP_URL}
                appearance={{
                  baseTheme: shadcn,
                }}
              >
                <Analytics>
                  <SyncEngine>
                    <SignedIn>
                      <CommandMenuProvider>
                        <TaskRuntimeProvider>
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
                        </TaskRuntimeProvider>
                      </CommandMenuProvider>
                    </SignedIn>
                    <SignedOut>
                      <Guard />
                    </SignedOut>
                  </SyncEngine>
                </Analytics>
              </ClerkProvider>
              <UpdateToast />
            </UpdateProvider>
          </Theme>
        </SettingsProvider>
        <Toaster />
      </>
    );
  } else {
    // Web app is running in user's browser,
    // only show sign in / sign up functionality.
    return (
      <>
        <SettingsProvider>
          <Theme>
            <ClerkProvider
              publishableKey={PUBLISHABLE_KEY}
              signInUrl={SIGN_IN_URL}
              signUpUrl={SIGN_UP_URL}
            >
              <Analytics>
                <Outlet />
              </Analytics>
            </ClerkProvider>
          </Theme>
        </SettingsProvider>
        <Toaster />
      </>
    );
  }
};

export const Route = createRootRoute({ component: RootLayout });
