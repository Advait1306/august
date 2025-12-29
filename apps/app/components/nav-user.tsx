import { ChevronsUpDown } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserButton, useUser } from "@clerk/clerk-react";
import { useRef } from "react";

export function NavUser() {
  const { user } = useUser();
  const buttonRef = useRef<HTMLDivElement>(null);

  return (
    <SidebarMenu>
      <SidebarMenuItem
        onClick={() => {
          buttonRef.current?.querySelector("button")?.click();
        }}
      >
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div ref={buttonRef}>
            <UserButton/>
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user?.fullName}</span>
            <span className="truncate text-xs">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
