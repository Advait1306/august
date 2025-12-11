import { useState, useEffect, useCallback } from "react";

interface UseScrollGradientsOptions {
  /**
   * Whether to drill down to find the scroll element via DOM query (for virtualized containers like VList)
   */
  drillToScrollElement?: boolean;
  /**
   * Optional delay before initializing (useful for waiting for VList to mount)
   */
  initDelay?: number;
}

export function useScrollGradients(
  scrollContainerRef: React.RefObject<HTMLElement | null>,
  options: UseScrollGradientsOptions = {}
) {
  const { drillToScrollElement = false, initDelay = 0 } = options;

  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(null);

  const getContainer = useCallback(() => {
    if (!scrollContainerRef.current) return null;

    const container = scrollContainerRef.current;

    // If drillToScrollElement, search for the scroll container created by virtualized lists
    if (drillToScrollElement) {
      const virtualContainer = container.querySelector('[style*="overflow"]') as HTMLElement;
      return virtualContainer;
    }

    return container;
  }, [scrollContainerRef, drillToScrollElement]);

  const recalculate = useCallback(() => {
    const container = getContainer();
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowTopGradient(scrollTop > 0);
    setShowBottomGradient(scrollTop + clientHeight < scrollHeight - 1);
  }, [getContainer]);

  // Track the container element - poll until found
  useEffect(() => {
    const checkContainer = () => {
      const container = getContainer();
      if (container) {
        setContainerElement(container);
        return true; // Found
      }
      return false; // Not found
    };

    if (initDelay > 0) {
      const timer = setTimeout(() => {
        if (!checkContainer()) {
          // If not found after delay, keep polling
          const interval = setInterval(() => {
            if (checkContainer()) {
              clearInterval(interval);
            }
          }, 50);

          // Stop polling after 1 second
          setTimeout(() => clearInterval(interval), 1000);
        }
      }, initDelay);
      return () => clearTimeout(timer);
    } else {
      if (!checkContainer()) {
        // If not found immediately, poll for it
        const interval = setInterval(() => {
          if (checkContainer()) {
            clearInterval(interval);
          }
        }, 50);

        // Stop polling after 1 second
        const timeout = setTimeout(() => clearInterval(interval), 1000);

        return () => {
          clearInterval(interval);
          clearTimeout(timeout);
        };
      }
    }
  }, [getContainer, initDelay]);

  // Set up scroll listeners when container is available
  useEffect(() => {
    if (!containerElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = containerElement;
      setShowTopGradient(scrollTop > 0);
      setShowBottomGradient(scrollTop + clientHeight < scrollHeight - 1);
    };

    // Initial check
    handleScroll();

    containerElement.addEventListener("scroll", handleScroll);
    // Also check on resize in case content changes
    const resizeObserver = new ResizeObserver(handleScroll);
    resizeObserver.observe(containerElement);

    return () => {
      containerElement.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [containerElement]);

  return {
    showTopGradient,
    showBottomGradient,
    recalculate,
  };
}
