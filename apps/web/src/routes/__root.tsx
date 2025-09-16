import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "../contexts/theme-context";
import { CommandMenuProvider } from "@/components/command-menu";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-react";
import Guard from "../../components/guard";

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

const RootLayout = () => {
  if (window.electron) {
    return (
      <>
        <ThemeProvider>
          <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
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
      </>
    );
  } else {
    return (
      <>
        <ThemeProvider>
          <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
            <Outlet />
          </ClerkProvider>
        </ThemeProvider>
        <TanStackRouterDevtools />
      </>
    );
  }
};

export const Route = createRootRoute({ component: RootLayout });
