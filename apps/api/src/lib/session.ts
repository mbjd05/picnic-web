import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { AuthServiceResult } from "@/lib/api-services/auth";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  COUNTRY_COOKIE_NAME,
  authCookieNameForCountry,
  parseAuthToken,
  parseCountryCookie,
} from "@/lib/session-cookies";
import type { CountryCode } from "@/lib/types";

export function readSession(c: Context) {
  const countryCode = parseCountryCookie(getCookie(c, COUNTRY_COOKIE_NAME));
  const token =
    parseAuthToken(getCookie(c, authCookieNameForCountry(countryCode))) ??
    parseAuthToken(getCookie(c, AUTH_COOKIE_NAME));
  return { token, countryCode };
}

function secureCookie(c: Context): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export function clearAuthCookie(c: Context): void {
  const countryCode = parseCountryCookie(getCookie(c, COUNTRY_COOKIE_NAME));
  const scopedCookieName = authCookieNameForCountry(countryCode);
  const hasScopedToken = parseAuthToken(getCookie(c, scopedCookieName)) !== null;

  deleteCookie(c, hasScopedToken ? scopedCookieName : AUTH_COOKIE_NAME, {
    secure: secureCookie(c),
    sameSite: "Strict",
    path: "/",
  });
}

export function applyAuthResultCookies(c: Context, result: AuthServiceResult): void {
  const countryCode = result.countryCode ?? parseCountryCookie(getCookie(c, COUNTRY_COOKIE_NAME));
  if (result.authToken) {
    setCookie(c, authCookieNameForCountry(countryCode), result.authToken, {
      httpOnly: true,
      secure: secureCookie(c),
      sameSite: "Strict",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    });
    deleteCookie(c, AUTH_COOKIE_NAME, {
      secure: secureCookie(c),
      sameSite: "Strict",
      path: "/",
    });
  }

  if (result.countryCode || result.authToken) {
    setCookie(c, COUNTRY_COOKIE_NAME, countryCode, {
      httpOnly: false,
      secure: secureCookie(c),
      sameSite: "Lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    });
  }
}

export function switchSessionCountry(c: Context, targetCountryCode: CountryCode): boolean {
  const currentCountryCode = parseCountryCookie(getCookie(c, COUNTRY_COOKIE_NAME));
  const currentScopedCookieName = authCookieNameForCountry(currentCountryCode);
  const targetScopedCookieName = authCookieNameForCountry(targetCountryCode);
  const legacyToken = parseAuthToken(getCookie(c, AUTH_COOKIE_NAME));
  const currentScopedToken = parseAuthToken(getCookie(c, currentScopedCookieName));
  const targetScopedToken = parseAuthToken(getCookie(c, targetScopedCookieName));

  if (legacyToken && !currentScopedToken) {
    setCookie(c, currentScopedCookieName, legacyToken, {
      httpOnly: true,
      secure: secureCookie(c),
      sameSite: "Strict",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    });
  }
  if (legacyToken) {
    deleteCookie(c, AUTH_COOKIE_NAME, {
      secure: secureCookie(c),
      sameSite: "Strict",
      path: "/",
    });
  }

  setCookie(c, COUNTRY_COOKIE_NAME, targetCountryCode, {
    httpOnly: false,
    secure: secureCookie(c),
    sameSite: "Lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });

  return (
    targetScopedToken !== null ||
    (targetCountryCode === currentCountryCode &&
      (currentScopedToken !== null || legacyToken !== null))
  );
}
