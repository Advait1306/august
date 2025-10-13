import { CustomMutatorDefs } from "@rocicorp/zero";

type AnalyticsConfig = {
  [category: string]: {
    [method: string]: {
      event: string;
      getProperties?: (args: any) => Record<string, any>;
    };
  };
};

export function wrapMutatorsWithAnalytics(
  mutators: CustomMutatorDefs,
  analyticsConfig: AnalyticsConfig,
  trackEvent: (event: string, properties: Record<string, any>) => Promise<void>
) {
  const wrapped = { ...mutators } as any;

  Object.keys(analyticsConfig).forEach((category) => {
    const mutatorCategory = wrapped[category];
    const configCategory = analyticsConfig[category];

    if (mutatorCategory && configCategory) {
      wrapped[category] = { ...mutatorCategory };

      Object.keys(configCategory).forEach((method) => {
        const originalFn = mutatorCategory[method];
        const config = configCategory[method];

        if (originalFn && config) {
          wrapped[category][method] = async (tx: any, args: any) => {
            const result = await originalFn(tx, args);

            // Track analytics asynchronously
            const properties = config.getProperties?.(args) || args;
            trackEvent(config.event, properties).catch(console.error);

            return result;
          };
        }
      });
    }
  });

  return wrapped as CustomMutatorDefs;
}
