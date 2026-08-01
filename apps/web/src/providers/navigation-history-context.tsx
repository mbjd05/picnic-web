import { createContext, useCallback, useContext, useRef } from "react";

import { useLocation } from "@tanstack/react-router";

type NavigationHistoryState = {
  hasInAppBackTarget: boolean;
};

const NavigationHistoryContext = createContext<NavigationHistoryState | null>(null);

function getLocationSignature(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.searchStr}${location.hash}`;
}

export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const locationRef = useRef<string | null>(null);
  const historyStateRef = useRef<NavigationHistoryState>({ hasInAppBackTarget: false });
  const signature = getLocationSignature(location);

  if (locationRef.current !== signature) {
    if (locationRef.current !== null) historyStateRef.current.hasInAppBackTarget = true;
    locationRef.current = signature;
  }

  return (
    <NavigationHistoryContext.Provider value={historyStateRef.current}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useInAppBack(fallback: () => void) {
  const historyState = useContext(NavigationHistoryContext);

  return useCallback(() => {
    if (historyState?.hasInAppBackTarget) {
      window.history.back();
      return;
    }
    fallback();
  }, [fallback, historyState]);
}
