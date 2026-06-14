"use client";

import { useEffect, useState } from "react";

import { buildSectionId } from "@/lib/types";

const STICKY_HEADER_OFFSET_PX = 144;
const VIEWPORT_FOCUS_RATIO = 0.45;

/**
 * Returns the index of the section currently occupying the central reading
 * area below the sticky header.
 *
 * @param sectionCount - Number of sections to observe.
 * @returns The zero-based index of the currently active section.
 */
export function useScrollSpy(sectionCount: number): number {
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  useEffect(() => {
    if (sectionCount === 0) return;

    const elements: HTMLElement[] = [];
    for (let i = 0; i < sectionCount; i++) {
      const el = document.getElementById(buildSectionId(i));
      if (el instanceof HTMLElement) elements.push(el);
    }

    if (elements.length === 0) return;

    let frameId: number | null = null;

    function updateActiveSection() {
      frameId = null;

      const focusY = Math.max(
        STICKY_HEADER_OFFSET_PX,
        Math.round(window.innerHeight * VIEWPORT_FOCUS_RATIO)
      );

      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < elements.length; index++) {
        const rect = elements[index].getBoundingClientRect();

        if (rect.top <= focusY && rect.bottom > focusY) {
          bestIndex = index;
          bestDistance = 0;
          break;
        }

        const distance = Math.min(Math.abs(rect.top - focusY), Math.abs(rect.bottom - focusY));
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }

      setActiveSectionIndex((current) => (current === bestIndex ? current : bestIndex));
    }

    function scheduleUpdate() {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateActiveSection);
    }

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [sectionCount]);

  return activeSectionIndex;
}
