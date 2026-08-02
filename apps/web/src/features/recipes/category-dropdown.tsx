import { useState } from "react";

export type RecipeCategoryOption = {
  id: string | null;
  name: string;
  section?: string;
  count?: number;
};

export function CategoryDropdown({
  options,
  value,
  onChange,
  searchPlaceholder,
  disabled,
}: {
  options: RecipeCategoryOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  searchPlaceholder: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.id === value) ?? options[0];
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? options.filter((option) =>
        [option.name, option.section ?? ""].some((text) => text.toLowerCase().includes(normalized))
      )
    : options;
  return (
    <div className="relative inline-block min-w-48">
      <button
        type="button"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${disabled ? "cursor-not-allowed opacity-40" : "hover:border-gray-400"}`}
      >
        <span className="text-foreground truncate">{selected.name}</span>
        <svg
          className={`text-text-muted h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="focus:ring-picnic-red w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.map((option, index) => {
              const previous = filtered[index - 1];
              const showSection = option.section && option.section !== previous?.section;
              const isSelected = option.id === value;
              return (
                <li key={option.id ?? "__featured__"}>
                  {showSection ? (
                    <div className="text-text-muted px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                      {option.section}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "text-picnic-red bg-red-50 font-semibold dark:bg-red-950/35"
                        : "text-foreground hover:bg-gray-50"
                    }`}
                  >
                    <span>{option.name}</span>
                    {option.count !== undefined ? (
                      <span className="ml-2 text-xs text-gray-400">{option.count}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
