import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

export const initMixpanel = () => {
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
