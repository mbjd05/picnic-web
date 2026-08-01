import { type ReactNode, createContext, useContext } from "react";
import { createPortal } from "react-dom";

const HeaderBottomBarContext = createContext<HTMLElement | null>(null);

export const HeaderBottomBarProvider = HeaderBottomBarContext.Provider;

export function HeaderBottomBar({ children }: { children: ReactNode }) {
  const host = useContext(HeaderBottomBarContext);
  return host ? createPortal(children, host) : null;
}
