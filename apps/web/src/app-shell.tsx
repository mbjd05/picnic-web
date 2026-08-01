import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";

import { getTranslations } from "@/lib/i18n";
import type { AuthApiResponse } from "@/lib/auth-types";
import type { SuggestionsApiResponse } from "@/lib/search-types";
import { MIN_SUGGESTION_LENGTH } from "@/lib/app-constants";
import { SUPPORTED_COUNTRY_CODES, SUPPORTED_LANGUAGE_CODES } from "@/lib/locale-types";
import type { CountryCode, LanguageCode } from "@/lib/locale-types";

import { CartProvider, useCartTotals } from "./cart-context";
import {
  CountryProvider,
  useCountryCode,
  useLanguageCode,
  useSwitchCountry,
  useSwitchLanguage,
} from "./country-context";
import { fetchJson } from "./lib/api-client";
import {
  CartIcon,
  LanguageIcon,
  MenuIcon,
  SearchIcon,
  ThemePreferenceIcon,
} from "./features/shell/header-icons";
import {
  type HeaderMenu,
  MobileHeaderMenuPanel,
  useMobileHeaderMenuPanel,
} from "./features/shell/mobile-header-menu-panel";
import { queryKeys, queryStaleTime } from "./lib/query-config";
import { ThemeProvider, type ThemePreference, useTheme } from "./theme-context";

const HeaderBottomBarContext = createContext<HTMLElement | null>(null);
const SUGGESTION_DEBOUNCE_MS = 150;
const SEARCH_HISTORY_STORAGE_KEY = "picnic_search_history";
const MAX_SEARCH_HISTORY_ITEMS = 6;

type SearchPopupItem = {
  id: string;
  label: string;
};

function readSearchHistory(): string[] {
  try {
    const value = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function writeSearchHistory(searches: string[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(searches));
  } catch {
    // Search history is a convenience only; ignore storage failures.
  }
}

export function HeaderBottomBar({ children }: { children: ReactNode }) {
  const host = useContext(HeaderBottomBarContext);
  return host ? createPortal(children, host) : null;
}

function formatCartPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

function AppHeader({ setBottomBarHost }: { setBottomBarHost: (host: HTMLElement | null) => void }) {
  const countryCode = useCountryCode();
  const switchCountry = useSwitchCountry();
  const languageCode = useLanguageCode();
  const switchLanguage = useSwitchLanguage();
  const {
    preference: themePreference,
    systemTheme,
    setPreference: setThemePreference,
  } = useTheme();
  const t = getTranslations(languageCode);
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState(
    () => new URLSearchParams(window.location.search).get("q") ?? ""
  );
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [suggestionSession, setSuggestionSession] = useState(0);
  const [recentSearches, setRecentSearches] = useState(readSearchHistory);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLocaleMenuOpen, setIsLocaleMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const localeMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const lastNonEmptySuggestionsRef = useRef<SuggestionsApiResponse["suggestions"]>([]);
  const cart = useCartTotals();

  useEffect(() => {
    setQuery(new URLSearchParams(location.searchStr).get("q") ?? "");
  }, [location.searchStr]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function closeSuggestions(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    }
    document.addEventListener("mousedown", closeSuggestions);
    return () => document.removeEventListener("mousedown", closeSuggestions);
  }, []);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) {
        return;
      }
      setIsMenuOpen(false);
      setIsLocaleMenuOpen(false);
      setIsThemeMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsLocaleMenuOpen(false);
    setIsThemeMenuOpen(false);
  }, [location.pathname, location.searchStr]);

  const suggestionsQuery = useQuery({
    queryKey: [
      "suggestions-session",
      suggestionSession,
      ...queryKeys.suggestions(debouncedQuery, countryCode),
    ],
    queryFn: () =>
      fetchJson<SuggestionsApiResponse>(`/api/suggestions?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= MIN_SUGGESTION_LENGTH,
    placeholderData: (previousData, previousQuery) => {
      const previousKey = previousQuery?.queryKey;
      const previousSession = previousKey?.[1];
      const previousTerm = previousKey?.[3];
      return previousSession === suggestionSession &&
        typeof previousTerm === "string" &&
        debouncedQuery.startsWith(previousTerm)
        ? previousData
        : undefined;
    },
    staleTime: queryStaleTime.suggestions,
    retry: false,
  });
  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const trimmedQuery = query.trim();
  const canShowSuggestions = trimmedQuery.length >= MIN_SUGGESTION_LENGTH;
  const displayedSuggestions =
    suggestions.length > 0
      ? suggestions
      : suggestionsQuery.isFetching && canShowSuggestions
        ? lastNonEmptySuggestionsRef.current
        : [];
  const popupItems: SearchPopupItem[] = canShowSuggestions
    ? displayedSuggestions.map((suggestion) => ({
        id: `suggestion-${suggestion.id}`,
        label: suggestion.suggestion,
      }))
    : trimmedQuery.length === 0
      ? recentSearches.map((search) => ({ id: `history-${search}`, label: search }))
      : [];
  const popupHeading = canShowSuggestions ? t.searchSuggestionsLabel : t.searchHistoryLabel;
  const canShowSearchPopup = showSuggestions && popupItems.length > 0;

  useEffect(() => {
    if (suggestions.length > 0) lastNonEmptySuggestionsRef.current = suggestions;
  }, [suggestions]);

  useEffect(() => {
    if (activeSuggestionIndex >= popupItems.length) setActiveSuggestionIndex(-1);
  }, [activeSuggestionIndex, popupItems.length]);

  function saveSearchTerm(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((current) => {
      const next = [
        trimmed,
        ...current.filter((item) => item.toLocaleLowerCase() !== trimmed.toLocaleLowerCase()),
      ].slice(0, MAX_SEARCH_HISTORY_ITEMS);
      writeSearchHistory(next);
      return next;
    });
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedQuery) {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      void navigate({ to: "/", search: {} });
      return;
    }
    saveSearchTerm(trimmedQuery);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    void navigate({ to: "/", search: { q: trimmedQuery } });
  }

  function selectSearchTerm(term: string) {
    saveSearchTerm(term);
    setQuery(term);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    void navigate({ to: "/", search: { q: term } });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }
    if (!showSuggestions || popupItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % popupItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index <= 0 ? popupItems.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const item = popupItems[activeSuggestionIndex];
      if (item) selectSearchTerm(item.label);
    }
  }

  async function handleSignOut() {
    try {
      await fetchJson<AuthApiResponse>("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  const showCartBadge = cart.totalCount > 0;
  const showCartBadgePlaceholder = cart.isLoading && !showCartBadge && !cart.hasStoredSummary;
  const activeSearchTerm = new URLSearchParams(location.searchStr).get("q")?.trim();

  function renderLocaleOption<TCode extends CountryCode | LanguageCode>({
    code,
    selected,
    label,
    onSelect,
  }: {
    code: TCode;
    selected: boolean;
    label: string;
    onSelect: (code: TCode) => void;
  }) {
    return (
      <button
        key={code}
        type="button"
        onClick={() => {
          onSelect(code);
          setIsLocaleMenuOpen(false);
        }}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
          selected
            ? "bg-picnic-red text-white"
            : "hover:text-foreground text-gray-600 hover:bg-gray-50"
        }`}
        aria-pressed={selected}
      >
        <span>{label}</span>
        <span className={selected ? "text-white/80" : "text-gray-400"}>{code}</span>
      </button>
    );
  }

  function renderThemeOption(preference: ThemePreference) {
    const selected = themePreference === preference;
    return (
      <button
        key={preference}
        type="button"
        onClick={() => {
          setThemePreference(preference);
          setIsThemeMenuOpen(false);
        }}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
          selected
            ? "bg-picnic-red text-white"
            : "hover:text-foreground text-gray-600 hover:bg-gray-50"
        }`}
        aria-pressed={selected}
      >
        <span className="flex items-center gap-2">
          <ThemePreferenceIcon preference={preference} />
          {preference === "system"
            ? t.themeSystem
            : preference === "dark"
              ? t.themeDark
              : t.themeLight}
        </span>
        {preference === "system" ? (
          <span className={selected ? "text-white/80" : "text-gray-400"}>
            {systemTheme === "dark" ? t.themeDark : t.themeLight}
          </span>
        ) : null}
      </button>
    );
  }

  function renderLocaleMenuContent() {
    return (
      <>
        <div className="p-1.5">
          <p className="px-3 py-1 text-xs font-semibold text-gray-400">{t.picnicRegion}</p>
          {SUPPORTED_COUNTRY_CODES.map((code) =>
            renderLocaleOption({
              code,
              selected: code === countryCode,
              label: t[`regionName${code}`],
              onSelect: switchCountry,
            })
          )}
        </div>
        <div className="border-card-border border-t p-1.5">
          <p className="px-3 py-1 text-xs font-semibold text-gray-400">{t.displayLanguage}</p>
          {displayLanguageOptions.map((code) =>
            renderLocaleOption({
              code,
              selected: code === languageCode,
              label: t[`languageName${code}`],
              onSelect: switchLanguage,
            })
          )}
        </div>
      </>
    );
  }

  function renderThemeMenuContent() {
    return (
      <div className="p-1.5">
        <p className="px-3 py-1 text-xs font-semibold text-gray-400">{t.themeMenu}</p>
        {(["system", "light", "dark"] as const).map(renderThemeOption)}
      </div>
    );
  }

  function renderPrimaryMenuContent() {
    return (
      <>
        <div className="p-1.5">
          <Link
            to="/cookbook"
            onClick={() => setIsMenuOpen(false)}
            tabIndex={isMenuOpen ? undefined : -1}
            className="hover:text-foreground block rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            {t.cookbookNavLink}
          </Link>
          <Link
            to="/deliveries"
            onClick={() => setIsMenuOpen(false)}
            tabIndex={isMenuOpen ? undefined : -1}
            className="hover:text-foreground block rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            {t.deliveriesNavLink}
          </Link>
          <Link
            to="/account/payment"
            search={{ from: undefined }}
            onClick={() => setIsMenuOpen(false)}
            tabIndex={isMenuOpen ? undefined : -1}
            className="hover:text-foreground block rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            {t.accountPaymentLink}
          </Link>
        </div>
        <div className="border-card-border border-t px-1.5 py-1">
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              void handleSignOut();
            }}
            tabIndex={isMenuOpen ? undefined : -1}
            className="hover:text-foreground block w-full rounded-md px-3 py-1.5 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            {t.signOut}
          </button>
        </div>
      </>
    );
  }

  const cartLink = (
    <Link
      to="/cart"
      search={{ returnSearch: activeSearchTerm || undefined }}
      className="border-card-border bg-card-bg text-foreground hover:border-picnic-red hover:text-picnic-red relative flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors sm:px-4"
      aria-label={t.cartTitle}
    >
      <span className="flex items-center gap-2">
        <CartIcon />
        <span className="hidden xl:inline">{t.cartTitle}</span>
      </span>
      {showCartBadge ? (
        <span className="hidden w-[3.1rem] shrink-0 justify-end min-[430px]:inline-flex">
          <span className="bg-picnic-red rounded-full px-2 py-0.5 text-center text-xs font-bold text-white tabular-nums">
            {formatCartPrice(cart.totalPrice)}
          </span>
        </span>
      ) : showCartBadgePlaceholder ? (
        <span
          className="hidden h-5 w-[3.1rem] shrink-0 animate-pulse rounded-full bg-gray-200 min-[430px]:inline-flex"
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );
  const displayLanguageOptions = [countryCode, "EN", ...SUPPORTED_LANGUAGE_CODES].filter(
    (code, index, options) => options.indexOf(code) === index
  ) as LanguageCode[];
  const activeMobileMenu: HeaderMenu | null = isLocaleMenuOpen
    ? "locale"
    : isThemeMenuOpen
      ? "theme"
      : isMenuOpen
        ? "primary"
        : null;
  const activeMobileMenuContent =
    activeMobileMenu === "locale"
      ? renderLocaleMenuContent()
      : activeMobileMenu === "theme"
        ? renderThemeMenuContent()
        : activeMobileMenu === "primary"
          ? renderPrimaryMenuContent()
          : null;
  const mobileMenuPanel = useMobileHeaderMenuPanel(activeMobileMenu);

  return (
    <header className="border-card-border sticky top-0 z-50 border-b bg-white/95 backdrop-blur-sm">
      <div
        ref={menuRef}
        className="relative mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:gap-x-3 sm:px-6 md:flex-nowrap md:gap-x-4"
      >
        <Link
          to="/"
          search={{}}
          className="text-picnic-red shrink-0 text-lg font-bold tracking-normal select-none min-[390px]:text-xl"
          aria-label="Picnic Web"
        >
          Picnic Web
        </Link>

        <form
          ref={searchRef}
          role="search"
          onSubmit={handleSearch}
          className="order-3 w-full md:order-1 md:flex-1 xl:w-[36rem] xl:flex-none 2xl:w-[42rem]"
        >
          <div className="relative mx-auto w-full max-w-2xl">
            <input
              type="search"
              value={query}
              onChange={(event) => {
                const nextQuery = event.target.value;
                if (query.trim() && !nextQuery.trim()) {
                  setSuggestionSession((session) => session + 1);
                }
                setQuery(nextQuery);
                setShowSuggestions(true);
                setActiveSuggestionIndex(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchAriaLabel}
              role="combobox"
              aria-autocomplete="list"
              aria-controls="product-search-suggestions"
              aria-expanded={canShowSearchPopup}
              aria-activedescendant={
                activeSuggestionIndex >= 0
                  ? `product-search-suggestion-${activeSuggestionIndex}`
                  : undefined
              }
              className="border-input-border text-foreground focus:border-input-focus focus:ring-input-focus/20 w-full rounded-full border bg-white px-4 py-2 pr-12 text-sm shadow-sm transition-shadow outline-none placeholder:text-gray-400 focus:ring-2"
            />
            <button
              type="submit"
              aria-label={t.searchButtonAriaLabel}
              className="bg-picnic-red hover:bg-picnic-red-dark absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors"
            >
              <SearchIcon />
            </button>
            {canShowSearchPopup ? (
              <ul
                id="product-search-suggestions"
                role="listbox"
                className="border-card-border bg-card-bg absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
              >
                <li
                  role="presentation"
                  className="border-card-border border-b px-4 py-2 text-xs font-bold tracking-wide text-gray-500 uppercase"
                >
                  {popupHeading}
                </li>
                {popupItems.map((item, index) => (
                  <li
                    id={`product-search-suggestion-${index}`}
                    key={item.id}
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                  >
                    <button
                      type="button"
                      onClick={() => selectSearchTerm(item.label)}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      className={`text-foreground w-full px-4 py-2.5 text-left text-sm focus:outline-none ${
                        index === activeSuggestionIndex ? "bg-gray-100" : "hover:bg-gray-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </form>

        <nav className="contents md:order-2 md:ml-auto md:flex md:shrink-0 md:items-center md:gap-2">
          <div className="order-1 ml-auto flex min-w-0 items-center sm:min-w-[9.25rem] md:order-none md:ml-0 xl:min-w-[13.25rem]">
            {cartLink}
          </div>
          <div ref={localeMenuRef} className="contents md:relative md:block">
            <button
              type="button"
              onClick={() => {
                mobileMenuPanel.snapshotHeight();
                setIsLocaleMenuOpen((isOpen) => !isOpen);
                setIsMenuOpen(false);
                setIsThemeMenuOpen(false);
              }}
              className={`order-1 flex h-9 items-center justify-center gap-1.5 rounded-full border px-2.5 text-sm font-medium transition-colors sm:px-3 md:order-none ${
                isLocaleMenuOpen
                  ? "border-picnic-red bg-picnic-red text-white"
                  : "border-card-border hover:text-foreground text-gray-600"
              }`}
              aria-label={t.languageRegionMenu}
              aria-controls="locale-navigation"
              aria-expanded={isLocaleMenuOpen}
            >
              <LanguageIcon />
              <span>{languageCode}</span>
            </button>
            <div
              id="locale-navigation"
              aria-hidden={!isLocaleMenuOpen}
              className={`border-card-border bg-card-bg order-last hidden basis-full overflow-hidden rounded-lg text-left shadow-sm transition-[max-height,opacity,transform] duration-150 ease-out motion-reduce:transition-none md:absolute md:top-full md:right-0 md:left-auto md:z-50 md:mt-2 md:block md:w-72 md:max-w-[calc(100vw-1.5rem)] md:basis-auto md:shadow-lg ${
                isLocaleMenuOpen
                  ? "order-4 max-h-[28rem] translate-y-0 border opacity-100"
                  : "pointer-events-none max-h-0 -translate-y-1 border-0 opacity-0 md:max-h-[28rem]"
              }`}
            >
              {renderLocaleMenuContent()}
            </div>
          </div>
          <div ref={themeMenuRef} className="contents md:relative md:block">
            <button
              type="button"
              onClick={() => {
                mobileMenuPanel.snapshotHeight();
                setIsThemeMenuOpen((isOpen) => !isOpen);
                setIsLocaleMenuOpen(false);
                setIsMenuOpen(false);
              }}
              className={`order-1 flex h-9 items-center justify-center gap-1.5 rounded-full border px-2.5 text-sm font-medium transition-colors sm:px-3 md:order-none ${
                isThemeMenuOpen
                  ? "border-picnic-red bg-picnic-red text-white"
                  : "border-card-border hover:text-foreground text-gray-600"
              }`}
              aria-label={t.themeMenu}
              aria-controls="theme-navigation"
              aria-expanded={isThemeMenuOpen}
            >
              <ThemePreferenceIcon preference={themePreference} />
              <span className="hidden sm:inline">
                {themePreference === "system"
                  ? t.themeSystem
                  : themePreference === "dark"
                    ? t.themeDark
                    : t.themeLight}
              </span>
            </button>
            <div
              id="theme-navigation"
              aria-hidden={!isThemeMenuOpen}
              className={`border-card-border bg-card-bg order-last hidden basis-full overflow-hidden rounded-lg text-left shadow-sm transition-[max-height,opacity,transform] duration-150 ease-out motion-reduce:transition-none md:absolute md:top-full md:right-0 md:left-auto md:z-50 md:mt-2 md:block md:w-56 md:max-w-[calc(100vw-1.5rem)] md:basis-auto md:shadow-lg ${
                isThemeMenuOpen
                  ? "order-4 max-h-72 translate-y-0 border opacity-100"
                  : "pointer-events-none max-h-0 -translate-y-1 border-0 opacity-0 md:max-h-72"
              }`}
            >
              {renderThemeMenuContent()}
            </div>
          </div>
          <div className="contents md:relative md:block">
            <button
              type="button"
              onClick={() => {
                mobileMenuPanel.snapshotHeight();
                setIsMenuOpen((isOpen) => !isOpen);
                setIsLocaleMenuOpen(false);
                setIsThemeMenuOpen(false);
              }}
              className={`order-1 flex h-9 items-center justify-center gap-2 rounded-full border px-2.5 text-sm font-medium transition-colors sm:px-3 md:order-none ${
                isMenuOpen
                  ? "border-picnic-red bg-picnic-red text-white"
                  : "border-card-border hover:text-foreground text-gray-600"
              }`}
              aria-label="Menu"
              aria-controls="primary-navigation"
              aria-expanded={isMenuOpen}
            >
              <MenuIcon />
              <span className="hidden sm:inline">Menu</span>
            </button>
            <div
              id="primary-navigation"
              aria-hidden={!isMenuOpen}
              className={`border-card-border bg-card-bg order-last hidden basis-full overflow-hidden rounded-lg text-left shadow-sm transition-[max-height,opacity,transform] duration-150 ease-out motion-reduce:transition-none md:absolute md:top-full md:right-0 md:left-auto md:z-50 md:mt-2 md:block md:w-72 md:max-w-[calc(100vw-1.5rem)] md:basis-auto md:shadow-lg ${
                isMenuOpen
                  ? "order-4 max-h-72 translate-y-0 border opacity-100"
                  : "pointer-events-none max-h-0 -translate-y-1 border-0 opacity-0 md:max-h-72"
              }`}
            >
              {renderPrimaryMenuContent()}
            </div>
          </div>
          <MobileHeaderMenuPanel
            contentRef={mobileMenuPanel.contentRef}
            height={mobileMenuPanel.height}
            panelRef={mobileMenuPanel.panelRef}
          >
            {activeMobileMenuContent}
          </MobileHeaderMenuPanel>
        </nav>
      </div>
      <div ref={setBottomBarHost} />
    </header>
  );
}

export function AuthenticatedShell() {
  const [bottomBarHost, setBottomBarHost] = useState<HTMLElement | null>(null);
  return (
    <ThemeProvider>
      <CountryProvider>
        <CartProvider>
          <HeaderBottomBarContext.Provider value={bottomBarHost}>
            <div className="flex min-h-screen flex-col">
              <AppHeader setBottomBarHost={setBottomBarHost} />
              <Outlet />
            </div>
          </HeaderBottomBarContext.Provider>
        </CartProvider>
      </CountryProvider>
    </ThemeProvider>
  );
}

export function StandaloneShell() {
  return (
    <ThemeProvider>
      <CountryProvider>
        <div className="flex min-h-screen flex-col">
          <Outlet />
        </div>
      </CountryProvider>
    </ThemeProvider>
  );
}
