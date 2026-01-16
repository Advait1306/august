"use client";

import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useIsMac } from "@/hooks/useIsMac";
import mixpanel from "mixpanel-browser";

const YOUTUBE_VIDEO_ID = "YOUR_VIDEO_ID_HERE"; // Replace with actual video ID

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
        </div>
      </section>
    </div>
  );
}
