import mixpanel from "mixpanel-browser";
import { Button } from "./ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useIsMac } from "@/hooks/useIsMac";

export default function DownloadButton() {
  const mobile = useIsMobile();
  const mac = useIsMac();

  return mobile || !mac ? (
    <span className="text-sm text-muted-foreground">Only available on Mac</span>
  ) : (
    <Button
      onClick={async () => {
        mixpanel.track("download_button");

        try {
          const response = await fetch(
            "https://api.github.com/repos/sixhuman/august-shell-release/releases/latest"
          );
          const release = await response.json();
          const dmgAsset = release.assets.find((asset: { name: string }) =>
            asset.name.endsWith(".dmg")
          );

          if (dmgAsset) {
            window.location.href = dmgAsset.browser_download_url;
          }
        } catch (error) {
          console.error("Failed to fetch latest release", error);
        }
      }}
    >
      Download now
    </Button>
  );
}
