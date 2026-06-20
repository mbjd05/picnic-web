import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  COUNTRY_COOKIE_NAME,
  type CountryCode,
  DEFAULT_COUNTRY_CODE,
  SUPPORTED_COUNTRY_CODES,
} from "@/lib/types";

const COUNTRY_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const CountryContext = createContext<CountryCode>(DEFAULT_COUNTRY_CODE);
const SwitchCountryContext = createContext<(code: CountryCode) => void>(() => undefined);

function readCountryCode(): CountryCode {
  if (typeof document === "undefined") return DEFAULT_COUNTRY_CODE;

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COUNTRY_COOKIE_NAME}=`));
  const value = cookie?.slice(COUNTRY_COOKIE_NAME.length + 1).toUpperCase();

  return value && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(value)
    ? (value as CountryCode)
    : DEFAULT_COUNTRY_CODE;
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const [countryCode] = useState(readCountryCode);

  useEffect(() => {
    document.documentElement.lang = countryCode.toLowerCase();
  }, [countryCode]);

  const switchCountry = useCallback((code: CountryCode) => {
    document.cookie = `${COUNTRY_COOKIE_NAME}=${code}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    window.location.reload();
  }, []);

  return (
    <CountryContext.Provider value={countryCode}>
      <SwitchCountryContext.Provider value={switchCountry}>
        {children}
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
