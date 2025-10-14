"use client";

import { initMixpanel } from "@/lib/analytics";
import { useEffect } from "react";

export const Analytics = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    initMixpanel();
  }, []);

  return <>{children}</>;
};
