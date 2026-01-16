"use client";

import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useIsMac } from "@/hooks/useIsMac";
import mixpanel from "mixpanel-browser";

const YOUTUBE_VIDEO_ID = "cJ4--pZs3Aw";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 text-sm font-medium text-foreground bg-muted border border-border rounded">
      {children}
    </kbd>
  );
}

function Shortcut({ keys, description }: { keys: string[]; description: string }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-2.5 text-foreground">{description}</td>
      <td className="px-4 py-2.5 text-right">
        <span className="inline-flex items-center gap-1">
          {keys.map((key, i) => (
            <Kbd key={i}>{key}</Kbd>
          ))}
        </span>
      </td>
    </tr>
  );
}

export default function DownloadPage() {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mobile = useIsMobile();
  const mac = useIsMac();

  const fetchDownloadUrl = useCallback(async () => {
    try {
      const response = await fetch(
        "https://api.github.com/repos/sixhuman/august-shell-release/releases/latest"
      );
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      const release = await response.json();
      const dmgAsset = release.assets?.find(
        (asset: { name: string }) => asset.name.endsWith(".dmg")
      );

      if (dmgAsset) {
        setDownloadUrl(dmgAsset.browser_download_url);
      } else {
        setError("No download available");
      }
    } catch {
      setError("Failed to fetch download");
    }
  }, []);

  const startDownload = useCallback(() => {
    if (downloadUrl) {
      mixpanel.track("download_started");
      window.location.href = downloadUrl;
    }
  }, [downloadUrl]);

  useEffect(() => {
    fetchDownloadUrl();
  }, [fetchDownloadUrl]);

  return (
    <div className="flex flex-col">
      <section className="w-full max-w-[840px] mx-auto px-10 sm:px-8 lg:px-12 py-16 sm:py-24">
        <div className="flex flex-col gap-12">
          {/* Video section */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl font-medium text-foreground">
                Getting Started
              </h1>
              {mobile || !mac ? (
                <span className="text-sm text-muted-foreground">
                  Only available on Mac
                </span>
              ) : error ? (
                <span className="text-sm text-red-500">{error}</span>
              ) : !downloadUrl ? (
                <span className="text-sm text-muted-foreground">Loading...</span>
              ) : (
                <button
                  onClick={startDownload}
                  className="px-6 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
                >
                  Download for Mac
                </button>
              )}
            </div>
            <p className="text-base sm:text-lg text-muted-foreground">
              Watch this video to learn how to use August.
            </p>
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted border border-border">
              <iframe
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}`}
                title="How to use August"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>

          {/* Keyboard shortcuts section */}
          <div className="flex flex-col gap-6">
            <h2 className="text-xl sm:text-2xl font-medium text-foreground">
              Keyboard Shortcuts
            </h2>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Shortcut</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td colSpan={2} className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
                      Tabs
                    </td>
                  </tr>
                  <Shortcut keys={["⌘", "N"]} description="New tab" />
                  <Shortcut keys={["⌘", "W"]} description="Close tab" />
                  <Shortcut keys={["⌘", "⇧", "T"]} description="Reopen closed tab" />
                  <Shortcut keys={["⌘", "1-9"]} description="Jump to tab" />
                  <Shortcut keys={["⌘", "⇧", "["]} description="Previous tab" />
                  <Shortcut keys={["⌘", "⇧", "]"]} description="Next tab" />
                  <tr className="border-b border-border">
                    <td colSpan={2} className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
                      Workspaces
                    </td>
                  </tr>
                  <Shortcut keys={["⌘", "⌥", "1-9"]} description="Jump to workspace" />
                  <Shortcut keys={["⌘", "⌥", "["]} description="Previous workspace" />
                  <Shortcut keys={["⌘", "⌥", "]"]} description="Next workspace" />
                  <tr className="border-b border-border">
                    <td colSpan={2} className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
                      General
                    </td>
                  </tr>
                  <Shortcut keys={["⌘", "K"]} description="Open command menu (theme)" />
                  <Shortcut keys={["⌘", "P"]} description="Open file finder" />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
