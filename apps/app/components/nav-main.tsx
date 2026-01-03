"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { ComponentType } from "react";
import { Link, useLocation } from "@tanstack/react-router";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type NavLinkItem = {
  type?: "link";
  title: string;
  url: string;
  icon: LucideIcon | ComponentType<any>;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
};

type NavComponentItem = {
  type: "component";
  component: ComponentType;
  key: string;
};

export type NavItem = NavLinkItem | NavComponentItem;

export function NavMain({
  items,
}: {
  items: NavItem[];
}) {
  const location = useLocation();
  const isSettingsPage = location.pathname.startsWith("/settings");
  const fromParam = isSettingsPage ? (location.search as any)?.from : undefined;

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          // Handle custom component items
          if (item.type === "component") {
            const Component = item.component;
            return (
              <SidebarMenuItem key={item.key}>
                <Component />
              </SidebarMenuItem>
            );
          }

          // Handle standard link items
          const isActive = location.pathname === item.url;
          const linkProps =
            isSettingsPage && fromParam
              ? { to: item.url, search: { from: fromParam } }
              : { to: item.url };

          return (
            <Collapsible key={item.title} asChild defaultOpen={isActive}>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive}
                >
                  <Link {...linkProps}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRight />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <Link to={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
