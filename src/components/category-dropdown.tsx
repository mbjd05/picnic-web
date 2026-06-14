"use client";

import { useEffect, useRef, useState } from "react";

type Option = { id: string | null; name: string; section?: string; count?: number };

type Props = {
  options: Option[];
  value: string | null;
  onChange: (id: string | null) => void;
  searchPlaceholder: string;
  disabled?: boolean;
};

export function CategoryDropdown({
  options,
  value,
  onChange,
  searchPlaceholder,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.id === value) ?? options[0];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((opt) =>
        [opt.name, opt.section ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      )
    : options;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll selected option into view when opening
  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector("[data-selected=true]") as HTMLElement | null;
    active?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative inline-block min-w-48">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`focus:ring-picnic-red flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:outline-none ${disabled ? "cursor-not-allowed opacity-40" : "hover:border-gray-400"}`}
      >
        <span className="text-foreground truncate">{selected.name}</span>
        <svg
          className={`text-text-muted h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="focus:ring-picnic-red w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2"
            />
          </div>
          <ul ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {filteredOptions.map((opt, index) => {
              const isSelected = opt.id === value;
              const previous = filteredOptions[index - 1];
              const showSection = opt.section && opt.section !== previous?.section;

              return (
                <li key={opt.id ?? "__featured__"}>
                  {showSection && (
                    <div className="text-text-muted px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                      {opt.section}
                    </div>
                  )}
                  <button
                    type="button"
                    data-selected={isSelected}
                    onClick={() => pick(opt.id)}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "text-picnic-red bg-red-50 font-semibold"
                        : "text-foreground hover:bg-gray-50"
                    }`}
                  >
                    <span>{opt.name}</span>
                    <span className="ml-2 flex shrink-0 items-center gap-1.5">
                      {opt.count !== undefined && (
                        <span
                          className={`text-xs font-medium ${
                            isSelected ? "text-picnic-red/70" : "text-gray-400"
                          }`}
                        >
                          {opt.count}
                        </span>
                      )}
                      {isSelected && (
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
