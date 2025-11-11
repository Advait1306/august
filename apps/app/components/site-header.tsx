import React from "react";

export function SiteHeader() {
  return (
    <header
      className="bg-sidebar sticky top-0 z-50 flex w-full items-center"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex h-(--header-height) w-full items-center justify-center px-4" />
    </header>
  );
}
