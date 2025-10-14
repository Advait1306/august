import * as React from "react";

export function useIsMac() {
  const [isMac, setIsMac] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  return !!isMac;
}
