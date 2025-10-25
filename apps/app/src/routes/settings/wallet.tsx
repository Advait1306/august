import { ShellOnly } from "@/components/restrictor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrganisation, getUsage } from "@jupiter/sync/queries/data";
import { useQuery } from "@rocicorp/zero/react";
import { useSyncContext } from "@/src/components/sync_engine";

type SettingsSearch = {
  from?: string;
};

export const Route = createFileRoute("/settings/wallet")({
  component: WalletSettings,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return {
      from: (search.from as string) || undefined,
    };
  },
});

function WalletSettings() {
  const syncData = useSyncContext();
  const [organisation] = useQuery(getOrganisation(syncData.authData));
  const [usage] = useQuery(getUsage(syncData.authData));

  const formatCost = (cents: number | null) => {
    if (cents === null) return "N/A";
    return `$${(cents / 100).toFixed(4)}`;
  };

  const formatDate = (timestamp: number | null) => {
    if (timestamp === null) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const loading = !organisation;
  const balance = organisation?.wallet ?? null;

  return (
    <ShellOnly>
      <div className="p-4 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold">Wallet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View your organization's wallet balance and usage history
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Balance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <div className="text-3xl font-bold">
                  {balance !== null ? formatCost(balance) : "N/A"}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage History (Last 50 Records)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : usage.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No usage records found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-semibold">Date</th>
                        <th className="text-left p-2 font-semibold">Model</th>
                        <th className="text-right p-2 font-semibold">
                          Input Tokens
                        </th>
                        <th className="text-right p-2 font-semibold">
                          Output Tokens
                        </th>
                        <th className="text-right p-2 font-semibold">
                          Cache Write
                        </th>
                        <th className="text-right p-2 font-semibold">
                          Cache Read
                        </th>
                        <th className="text-right p-2 font-semibold">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b last:border-0 hover:bg-muted/50"
                        >
                          <td className="p-2 text-muted-foreground">
                            {formatDate(record.created_at)}
                          </td>
                          <td className="p-2 font-mono text-xs">
                            {record.model}
                          </td>
                          <td className="p-2 text-right font-mono text-xs">
                            {formatNumber(record.input_tokens)}
                          </td>
                          <td className="p-2 text-right font-mono text-xs">
                            {formatNumber(record.output_tokens)}
                          </td>
                          <td className="p-2 text-right font-mono text-xs">
                            {formatNumber(record.cache_creation_input_tokens)}
                          </td>
                          <td className="p-2 text-right font-mono text-xs">
                            {formatNumber(record.cache_read_input_tokens)}
                          </td>
                          <td className="p-2 text-right font-semibold">
                            {formatCost(record.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ShellOnly>
  );
}
