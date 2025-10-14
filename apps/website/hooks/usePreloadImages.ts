import { useEffect } from "react";

export function usePreloadImages(urls: string[]) {
  useEffect(() => {
    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [urls]);
}
