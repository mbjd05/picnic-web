import type { Translations } from "@/lib/i18n/translations";

import type { ResolvedTheme, ThemePreference } from "../../providers/theme-context";
import { ThemePreferenceIcon } from "./header-icons";

type ThemeMenuProps = {
  preference: ThemePreference;
  systemTheme: ResolvedTheme;
  t: Translations;
  onSelect: (preference: ThemePreference) => void;
};

const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

function getThemePreferenceLabel(preference: ThemePreference, t: Translations): string {
  if (preference === "system") return t.themeSystem;
  if (preference === "dark") return t.themeDark;
  return t.themeLight;
}

function ThemeOption({
  preference,
  selected,
  systemTheme,
  t,
  onSelect,
}: {
  preference: ThemePreference;
  selected: boolean;
  systemTheme: ResolvedTheme;
  t: Translations;
  onSelect: (preference: ThemePreference) => void;
}) {
  return (
    <button
      key={preference}
      type="button"
      onClick={() => onSelect(preference)}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
        selected
          ? "bg-picnic-red text-white"
          : "hover:text-foreground text-gray-600 hover:bg-gray-50"
      }`}
      aria-pressed={selected}
    >
      <span className="flex items-center gap-2">
        <ThemePreferenceIcon preference={preference} />
        {getThemePreferenceLabel(preference, t)}
      </span>
      {preference === "system" ? (
        <span className={selected ? "text-white/80" : "text-gray-400"}>
          {systemTheme === "dark" ? t.themeDark : t.themeLight}
        </span>
      ) : null}
    </button>
  );
}

export function ThemeMenu({ preference, systemTheme, t, onSelect }: ThemeMenuProps) {
  return (
    <div className="p-1.5">
      <p className="px-3 py-1 text-xs font-semibold text-gray-400">{t.themeMenu}</p>
      {THEME_PREFERENCES.map((option) => (
        <ThemeOption
          key={option}
          preference={option}
          selected={preference === option}
          systemTheme={systemTheme}
          t={t}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function CurrentThemePreferenceLabel({
  preference,
  t,
}: {
  preference: ThemePreference;
  t: Translations;
}) {
  return getThemePreferenceLabel(preference, t);
}
