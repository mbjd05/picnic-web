"use client";

import { forwardRef, useEffect, useRef } from "react";

import { useTranslations } from "@/contexts/country-context";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import type { SearchSection } from "@/lib/types";
import { buildSectionId } from "@/lib/types";

type SectionNavBarProps = {
  sections: SearchSection[];
};

export function SectionNavBar({ sections }: SectionNavBarProps) {
  const t = useTranslations();
  const activeSectionIndex = useScrollSpy(sections.length);
  const badgeRefs = useRef<Map<number, HTMLAnchorElement>>(new Map());

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the badge bar to keep the active badge visible.
  useEffect(() => {
    const el = badgeRefs.current.get(activeSectionIndex);
    const container = scrollContainerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const padding = 16;
      const isFullyVisible =
        elRect.left >= containerRect.left + padding &&
        elRect.right <= containerRect.right - padding;

      if (!isFullyVisible) {
        const targetScroll =
          container.scrollLeft +
          elRect.left -
          containerRect.left -
          containerRect.width / 2 +
          elRect.width / 2;

        container.scrollTo({ left: targetScroll, behavior: "auto" });
      }
    }
  }, [activeSectionIndex]);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Section navigation"
      className="border-card-border border-t bg-white/95 backdrop-blur-sm"
    >
      <div
        ref={scrollContainerRef}
        className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-2"
      >
        {sections.map((section, index) => (
          <SectionBadge
            key={index}
            ref={(el) => {
              if (el) {
                badgeRefs.current.set(index, el);
              } else {
                badgeRefs.current.delete(index);
              }
            }}
            index={index}
            title={section.title}
            isActive={index === activeSectionIndex}
            goToPrefix={t.sectionNavGoTo}
          />
        ))}
      </div>
    </nav>
  );
}

type SectionBadgeProps = {
  index: number;
  title: string;
  isActive: boolean;
  goToPrefix: string;
};

const SectionBadge = forwardRef<HTMLAnchorElement, SectionBadgeProps>(function SectionBadge(
  { index, title, isActive, goToPrefix },
  ref
) {
  return (
    <a
      ref={ref}
      href={`#${buildSectionId(index)}`}
      aria-label={`${goToPrefix} ${title}`}
      aria-current={isActive ? "true" : undefined}
      className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap no-underline transition-colors ${
        isActive ? "bg-picnic-red text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {title}
    </a>
  );
});
