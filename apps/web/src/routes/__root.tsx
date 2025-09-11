import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "../contexts/theme-context";
import { CommandMenuProvider } from "@/components/command-menu";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";

const RootLayout = () => (
  <>
    <ThemeProvider>
      <CommandMenuProvider>
        <div className="[--header-height:calc(--spacing(9))]">
          <SidebarProvider className="flex flex-col">
            <SiteHeader />
            <div className="flex flex-1">
              <AppSidebar />
              <SidebarInset>
                <Outlet />
              </SidebarInset>
            </div>
          </SidebarProvider>
        </div>
      </CommandMenuProvider>
    </ThemeProvider>
    <hr />
    <TanStackRouterDevtools />
  </>
);

export const Route = createRootRoute({ component: RootLayout });
