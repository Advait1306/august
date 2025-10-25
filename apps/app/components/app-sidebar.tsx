import * as React from "react";
import {
  Bot,
  CheckSquare,
  FolderKanban,
  Palette,
  Wrench,
  ChevronLeft,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { OrganizationSwitcher } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Tasks",
      url: "/tasks",
      icon: CheckSquare,
    },
    {
      title: "Projects",
      url: "/projects",
      icon: FolderKanban,
    },
    {
      title: "Agents",
      url: "/agents",
      icon: Bot,
    },
    // {
    //   title: "MCP",
    //   url: "/mcp",
    //   icon: MCPIcon,
    // },
  ],
  settingsNav: [
    {
      title: "Appearance",
      url: "/settings/appearance",
      icon: Palette,
    },
    {
      title: "Claude Code",
      url: "/settings/claude-code",
      icon: Wrench,
    },
  ],
  navSecondary: [],
  projects: [],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const navigate = useNavigate();
  const isSettingsPage = location.pathname.startsWith("/settings");
  const fromParam = isSettingsPage ? (location.search as any)?.from : undefined;

  const handleBack = () => {
    const backTo = fromParam || "/tasks";
    navigate({ to: backTo as any });
  };

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader>
        {isSettingsPage ? (
          <Button
            variant="ghost"
            className="w-full justify-start m-0 h-7"
            onClick={handleBack}
            hotkey="Escape"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <OrganizationSwitcher />
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={isSettingsPage ? data.settingsNav : data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      {!isSettingsPage && (
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
