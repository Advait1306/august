import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useLocation } from "@tanstack/react-router";
import React from "react";

export function SiteHeader() {
  const location = useLocation();

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case "/tasks":
        return "Tasks";
      case "/projects":
        return "Projects";
      case "/agents":
        return "Agents";
      case "/mcp":
        return "MCP";
      default:
        return "Dashboard";
    }
  };

  const currentPage = getPageTitle(location.pathname);

  return (
    <header
      className="bg-sidebar sticky top-0 z-50 flex w-full items-center border-b"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex h-(--header-height) w-full items-center justify-center px-4">
        <Breadcrumb
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{currentPage}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
