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
import { MIN_SUGGESTION_LENGTH, SUPPORTED_COUNTRY_CODES } from "@/lib/types";

import { CartProvider, useCart } from "./cart-context";
import { CountryProvider, useCountryCode, useSwitchCountry } from "./country-context";
import { fetchJson } from "./lib/api-client";

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

function formatCartPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

function AppHeader({ setBottomBarHost }: { setBottomBarHost: (host: HTMLElement | null) => void }) {
  const countryCode = useCountryCode();
  const switchCountry = useSwitchCountry();
  const t = getTranslations(countryCode);
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState(
    () => new URLSearchParams(window.location.search).get("q") ?? ""
  );
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchRef = useRef<HTMLFormElement>(null);
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

  const suggestionsQuery = useQuery({
    queryKey: ["suggestions", debouncedQuery, countryCode],
    queryFn: () =>
      fetchJson<SuggestionsApiResponse>(`/api/suggestions?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= MIN_SUGGESTION_LENGTH,
    placeholderData: (previousData) => previousData,
    staleTime: 60_000,
    retry: false,
  });
  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const canShowSuggestions = query.trim().length >= MIN_SUGGESTION_LENGTH;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
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
    if (!showSuggestions || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const suggestion = suggestions[activeSuggestionIndex];
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

  return (
    <header className="border-card-border sticky top-0 z-50 border-b bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 md:flex-nowrap">
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
          className="order-3 w-full md:order-none md:flex-1"
        >
          <div className="relative mx-auto w-full max-w-2xl">
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
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
              aria-expanded={showSuggestions && canShowSuggestions && suggestions.length > 0}
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
            {showSuggestions && canShowSuggestions && suggestions.length ? (
              <ul
                id="product-search-suggestions"
                role="listbox"
                className="border-card-border bg-card-bg absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
              >
                {suggestions.map((suggestion, index) => (
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

        <nav className="order-2 ml-auto flex max-w-full min-w-0 items-center gap-3 overflow-x-auto md:order-none md:ml-0">
          <div className="flex shrink-0 items-center gap-1">
            {SUPPORTED_COUNTRY_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => switchCountry(code)}
                className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                  code === countryCode
                    ? "bg-picnic-red text-white"
                    : "hover:text-foreground text-gray-500"
                }`}
                aria-pressed={code === countryCode}
              >
                {code}
              </button>
            ))}
          </div>

          <Link
            to="/cookbook"
            className="hover:text-foreground shrink-0 text-xs text-gray-500 transition-colors sm:text-sm"
          >
            {t.cookbookNavLink}
          </Link>
          <Link
            to="/account/payment"
            className="hover:text-foreground shrink-0 text-xs text-gray-500 transition-colors sm:text-sm"
          >
            {t.accountPaymentLink}
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="hover:text-foreground shrink-0 text-xs text-gray-500 transition-colors sm:text-sm"
          >
            {t.signOut}
          </button>
          <Link
            to="/cart"
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
        </nav>
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
