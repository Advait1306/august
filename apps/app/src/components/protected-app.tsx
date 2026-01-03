import { Outlet } from "@tanstack/react-router";
import { CommandMenuProvider } from "@/components/command-menu";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";
import { TaskRuntimeProvider } from "@/src/contexts/task-runtime";
import { BillingGuard } from "./billing-guard";

export function ProtectedApp() {
  // BillingGuard renders inline - shows welcome/resubscribe screens
  // or children based on subscription status
  return (
    <BillingGuard>
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
    </BillingGuard>
  );
}
