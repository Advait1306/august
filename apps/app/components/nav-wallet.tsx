"use client";

import { Wallet } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSyncContext } from "@/src/components/sync_engine";
import { useQuery } from "@rocicorp/zero/react";
import { getOrganisation } from "@jupiter/sync/queries/data";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

export function NavWallet() {
  const syncData = useSyncContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [organisation] = useQuery(getOrganisation(syncData.authData));

  const balance = organisation?.wallet ?? null;
  const loading = !organisation;

  const formatCost = (cents: number | null) => {
    if (cents === null) return "N/A";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleClick = () => {
    navigate({
      to: "/settings/wallet",
      search: { from: location.pathname },
    } as any);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          onClick={handleClick}
          className="cursor-pointer hover:bg-sidebar-accent"
        >
          <div className="">
            <Wallet className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate text-xs text-muted-foreground">
              Balance
            </span>
            {loading ? (
              <Skeleton className="h-4 w-16 mt-1" />
            ) : (
              <span className="truncate font-semibold">
                {formatCost(balance)}
              </span>
            )}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
