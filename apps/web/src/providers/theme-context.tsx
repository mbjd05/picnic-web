import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "picnic_theme";
const THEME_TRANSITION_CLASS = "theme-transitioning";
const THEME_TRANSITION_DURATION_MS = 180;

const ThemeContext = createContext<{
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}>({
  preference: "system",
  resolvedTheme: "light",
  systemTheme: "light",
  setPreference: () => undefined,
});

function readStoredThemePreference(): ThemePreference {
  if (typeof localStorage === "undefined") return "system";
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

function applyResolvedTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

function withThemeTransition(updateTheme: () => void): void {
  if (typeof document === "undefined") {
    updateTheme();
    return;
  }

  const root = document.documentElement;
  const startViewTransition = document.startViewTransition;
  root.classList.add(THEME_TRANSITION_CLASS);

  const finish = () => {
    window.setTimeout(
      () => root.classList.remove(THEME_TRANSITION_CLASS),
      THEME_TRANSITION_DURATION_MS
    );
  };

  if (
    typeof startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    startViewTransition.call(document, updateTheme).finished.finally(finish);
    return;
  }

  updateTheme();
  finish();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readStoredThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const resolvedTheme = resolveTheme(preference, systemTheme);

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const setPreference = useMemo(
    () => (nextPreference: ThemePreference) => {
      localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
      const nextResolvedTheme = resolveTheme(nextPreference, systemTheme);
      if (nextResolvedTheme === resolvedTheme) {
        setPreferenceState(nextPreference);
        return;
      }
      withThemeTransition(() => setPreferenceState(nextPreference));
    },
    [resolvedTheme, systemTheme]
  );

  const value = useMemo(
    () => ({ preference, resolvedTheme, systemTheme, setPreference }),
    [preference, resolvedTheme, systemTheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
