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
import type { AuthApiResponse, SuggestionsApiResponse } from "@/lib/types";
import {
  MIN_SUGGESTION_LENGTH,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_LANGUAGE_CODES,
  type CountryCode,
  type LanguageCode,
} from "@/lib/types";

import { CartProvider, useCart } from "./cart-context";
import {
  CountryProvider,
  useCountryCode,
  useLanguageCode,
  useSwitchCountry,
  useSwitchLanguage,
} from "./country-context";
import { fetchJson } from "./lib/api-client";
import { queryKeys, queryStaleTime } from "./lib/query-config";

const HeaderBottomBarContext = createContext<HTMLElement | null>(null);
const SUGGESTION_DEBOUNCE_MS = 150;

export function HeaderBottomBar({ children }: { children: ReactNode }) {
  const host = useContext(HeaderBottomBarContext);
  return host ? createPortal(children, host) : null;
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.75}
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802"
      />
    </svg>
  );
}

function formatCartPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

function AppHeader({ setBottomBarHost }: { setBottomBarHost: (host: HTMLElement | null) => void }) {
  const countryCode = useCountryCode();
  const switchCountry = useSwitchCountry();
  const languageCode = useLanguageCode();
  const switchLanguage = useSwitchLanguage();
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLocaleMenuOpen, setIsLocaleMenuOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const localeMenuRef = useRef<HTMLDivElement>(null);
  const lastNonEmptySuggestionsRef = useRef<SuggestionsApiResponse["suggestions"]>([]);
  const cart = useCart();

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
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (localeMenuRef.current && !localeMenuRef.current.contains(event.target as Node)) {
        setIsLocaleMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsLocaleMenuOpen(false);
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
  const canShowSuggestions = query.trim().length >= MIN_SUGGESTION_LENGTH;
  const displayedSuggestions =
    suggestions.length > 0
      ? suggestions
      : suggestionsQuery.isFetching && canShowSuggestions
        ? lastNonEmptySuggestionsRef.current
        : [];

  useEffect(() => {
    if (suggestions.length > 0) lastNonEmptySuggestionsRef.current = suggestions;
  }, [suggestions]);

  useEffect(() => {
    if (activeSuggestionIndex >= displayedSuggestions.length) setActiveSuggestionIndex(-1);
  }, [activeSuggestionIndex, displayedSuggestions.length]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      void navigate({ to: "/", search: {} });
      return;
    }
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    void navigate({ to: "/", search: { q: trimmed } });
  }

  function selectSuggestion(suggestion: string) {
    setQuery(suggestion);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    void navigate({ to: "/", search: { q: suggestion } });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }
    if (!showSuggestions || displayedSuggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % displayedSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((index) =>
        index <= 0 ? displayedSuggestions.length - 1 : index - 1
      );
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const suggestion = displayedSuggestions[activeSuggestionIndex];
      if (suggestion) selectSuggestion(suggestion.suggestion);
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

  const cartLink = (
    <Link
      to="/cart"
      search={{ returnSearch: activeSearchTerm || undefined }}
      className="hover:text-foreground relative flex shrink-0 items-center text-gray-600 transition-colors"
      aria-label="Winkelwagen"
    >
      <CartIcon />
      {showCartBadge ? (
        <span className="bg-picnic-red ml-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white">
          {formatCartPrice(cart.totalPrice)}
        </span>
      ) : null}
    </Link>
  );
  const displayLanguageOptions = [countryCode, "EN", ...SUPPORTED_LANGUAGE_CODES].filter(
    (code, index, options) => options.indexOf(code) === index
  ) as LanguageCode[];

  return (
    <header className="border-card-border sticky top-0 z-50 border-b bg-white/95 backdrop-blur-sm">
      <div
        ref={menuRef}
        className="relative mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-6 md:flex-nowrap md:gap-x-4"
      >
        <Link
          to="/"
          search={{}}
          className="text-picnic-red shrink-0 text-xl font-bold tracking-normal select-none"
          aria-label="Picnic Web"
        >
          Picnic Web
        </Link>

        <form
          ref={searchRef}
          role="search"
          onSubmit={handleSearch}
          className="order-3 w-full md:order-1 md:flex-1"
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
              aria-expanded={
                showSuggestions && canShowSuggestions && displayedSuggestions.length > 0
              }
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
            {showSuggestions && canShowSuggestions && displayedSuggestions.length ? (
              <ul
                id="product-search-suggestions"
                role="listbox"
                className="border-card-border bg-card-bg absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
              >
                {displayedSuggestions.map((suggestion, index) => (
                  <li
                    id={`product-search-suggestion-${index}`}
                    key={suggestion.id}
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                  >
                    <button
                      type="button"
                      onClick={() => selectSuggestion(suggestion.suggestion)}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      className={`text-foreground w-full px-4 py-2.5 text-left text-sm focus:outline-none ${
                        index === activeSuggestionIndex ? "bg-gray-100" : "hover:bg-gray-100"
                      }`}
                    >
                      {suggestion.suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </form>

        <nav className="order-1 ml-auto flex shrink-0 items-center gap-2 md:order-2">
          <div ref={localeMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsLocaleMenuOpen((isOpen) => !isOpen)}
              className={`flex h-9 items-center justify-center gap-1.5 rounded-full border px-2.5 text-sm font-medium transition-colors sm:px-3 ${
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
              className={`border-card-border bg-card-bg fixed top-14 right-3 left-3 z-50 mt-2 origin-top-right overflow-hidden rounded-lg border text-left shadow-lg transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none sm:absolute sm:top-full sm:right-0 sm:left-auto sm:w-72 sm:max-w-[calc(100vw-1.5rem)] ${
                isLocaleMenuOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              }`}
            >
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
            </div>
          </div>
          {cartLink}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
              className={`flex h-9 items-center justify-center gap-2 rounded-full border px-2.5 text-sm font-medium transition-colors sm:px-3 ${
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
          </div>
        </nav>

        <div
          id="primary-navigation"
          aria-hidden={!isMenuOpen}
          className={`border-card-border bg-card-bg z-50 order-4 w-full origin-top overflow-hidden rounded-lg border text-left shadow-lg transition-[max-height,opacity,transform] duration-150 ease-out motion-reduce:transition-none md:absolute md:top-full md:right-6 md:mt-2 md:w-72 md:max-w-[calc(100vw-1.5rem)] md:origin-top-right ${
            isMenuOpen
              ? "max-h-72 translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-1 opacity-0 md:max-h-72"
          }`}
        >
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
          <div className="border-card-border border-t p-1.5">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                void handleSignOut();
              }}
              tabIndex={isMenuOpen ? undefined : -1}
              className="hover:text-foreground block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              {t.signOut}
            </button>
          </div>
        </div>
      </div>
      <div ref={setBottomBarHost} />
    </header>
  );
}

export function AuthenticatedShell() {
  const [bottomBarHost, setBottomBarHost] = useState<HTMLElement | null>(null);
  return (
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
  );
}

export function StandaloneShell() {
  return (
    <CountryProvider>
      <div className="flex min-h-screen flex-col">
        <Outlet />
      </div>
    </CountryProvider>
  );
}
