import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  COUNTRY_COOKIE_NAME,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_COUNTRY_CODE,
  LANGUAGE_COOKIE_NAME,
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_COUNTRY_CODES,
} from "@/types/locale";
import type { CountryCode, LanguageCode } from "@/types/locale";
import type { SwitchCountryResponse } from "@/types/auth";
import { getTranslations } from "@/lib/i18n/translations";

import { fetchJson } from "../lib/api-client";

const COUNTRY_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const CountryContext = createContext<CountryCode>(DEFAULT_COUNTRY_CODE);
const SwitchCountryContext = createContext<(code: CountryCode) => void>(() => undefined);
const LanguageContext = createContext<LanguageCode>(DEFAULT_LANGUAGE_CODE);
const SwitchLanguageContext = createContext<(code: LanguageCode) => void>(() => undefined);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function readCountryCode(): CountryCode {
  const value = readCookie(COUNTRY_COOKIE_NAME)?.toUpperCase();

  return value && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(value)
    ? (value as CountryCode)
    : DEFAULT_COUNTRY_CODE;
}

function readLanguageCode(): LanguageCode {
  const value = readCookie(LANGUAGE_COOKIE_NAME)?.toUpperCase();

  return value && (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(value)
    ? (value as LanguageCode)
    : readCountryCode();
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const [countryCode] = useState(readCountryCode);
  const [languageCode, setLanguageCode] = useState(readLanguageCode);

  useEffect(() => {
    document.documentElement.lang = languageCode.toLowerCase();
  }, [languageCode]);

  const switchCountry = useCallback(
    async (code: CountryCode) => {
      if (code === countryCode) return;

      try {
        const result = await fetchJson<SwitchCountryResponse>("/api/auth/switch-country", {
          method: "POST",
          body: JSON.stringify({ countryCode: code }),
        });

        if (result.authenticated) {
          window.location.reload();
          return;
        }

        const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const search = new URLSearchParams({ redirect });
        window.location.assign(`/login?${search.toString()}`);
      } catch {
        document.cookie = `${COUNTRY_COOKIE_NAME}=${code}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
        window.location.reload();
      }
    },
    [countryCode]
  );

  const switchLanguage = useCallback((code: LanguageCode) => {
    document.cookie = `${LANGUAGE_COOKIE_NAME}=${code}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    setLanguageCode(code);
  }, []);

  return (
    <CountryContext.Provider value={countryCode}>
      <SwitchCountryContext.Provider value={switchCountry}>
        <LanguageContext.Provider value={languageCode}>
          <SwitchLanguageContext.Provider value={switchLanguage}>
            {children}
          </SwitchLanguageContext.Provider>
        </LanguageContext.Provider>
      </SwitchCountryContext.Provider>
    </CountryContext.Provider>
  );
}

export function useCountryCode(): CountryCode {
  return useContext(CountryContext);
}

export function useSwitchCountry(): (code: CountryCode) => void {
  return useContext(SwitchCountryContext);
}

export function useLanguageCode(): LanguageCode {
  return useContext(LanguageContext);
}

export function useSwitchLanguage(): (code: LanguageCode) => void {
  return useContext(SwitchLanguageContext);
}

export function useTranslations() {
  return getTranslations(useLanguageCode());
}
