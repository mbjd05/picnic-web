import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

export type HeaderMenu = "locale" | "theme" | "primary";

export function useMobileHeaderMenuPanel(activeMenu: HeaderMenu | null) {
  const [height, setHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  function measureContentHeight() {
    const contentHeight = contentRef.current?.getBoundingClientRect().height ?? 0;
    setHeight(Math.ceil(contentHeight) + 2);
  }

  function snapshotHeight() {
    const panel = panelRef.current;
    if (!panel || window.matchMedia("(min-width: 768px)").matches) return;
    setHeight(Math.ceil(panel.getBoundingClientRect().height));
  }

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    []
  );

  useLayoutEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (!activeMenu) {
      animationFrameRef.current = requestAnimationFrame(() => {
        setHeight(0);
        animationFrameRef.current = null;
      });
      return;
    }
    const nextHeight = Math.ceil(contentRef.current?.getBoundingClientRect().height ?? 0) + 2;
    if (nextHeight > height) {
      setHeight(nextHeight);
      return;
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      setHeight(nextHeight);
      animationFrameRef.current = null;
    });
  }, [activeMenu, height]);

  useEffect(() => {
    if (!activeMenu) return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    function syncHeight() {
      if (!mediaQuery.matches) return;
      requestAnimationFrame(measureContentHeight);
    }

    syncHeight();
    mediaQuery.addEventListener("change", syncHeight);
    window.addEventListener("resize", syncHeight);
    return () => {
      mediaQuery.removeEventListener("change", syncHeight);
      window.removeEventListener("resize", syncHeight);
    };
  }, [activeMenu]);

  return { height, panelRef, contentRef, snapshotHeight };
}

export function MobileHeaderMenuPanel({
  children,
  contentRef,
  height,
  panelRef,
}: {
  children: ReactNode;
  contentRef: React.RefObject<HTMLDivElement | null>;
  height: number;
  panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isOpen = Boolean(children);
  return (
    <div
      ref={panelRef}
      aria-hidden={!isOpen}
      className={`outline-card-border bg-card-bg order-4 basis-full overflow-hidden rounded-lg text-left shadow-sm outline -outline-offset-1 duration-150 ease-out motion-reduce:transition-none md:hidden ${
        isOpen
          ? "max-h-[28rem] translate-y-0 opacity-100"
          : "pointer-events-none max-h-0 translate-y-0 opacity-0"
      } transition-[height,opacity]`}
      style={{ height: isOpen ? `${height}px` : "0px" }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
