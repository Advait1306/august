import { useUser } from "@clerk/clerk-react";
import mixpanel from "mixpanel-browser";
import { useEffect } from "react";

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

const initMixpanel = () => {
  if (!MIXPANEL_TOKEN) {
    console.warn("Mixpanel token is missing! Check .env file.");
    return;
  }

  mixpanel.init(MIXPANEL_TOKEN, {
    api_host: "https://api-eu.mixpanel.com",
    autocapture: true,
    ignore_dnt: true,
    record_sessions_percent: 100,
    record_heatmap_data: true,
  });
};

export const Analytics = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    initMixpanel();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      mixpanel.identify(user.id);
      mixpanel.people.set({
        $email: user.primaryEmailAddress?.emailAddress,
        $name: user.fullName,
      });
    } else {
      mixpanel.reset();
    }
  }, [user, isLoaded]);

  return <>{children}</>;
};
