import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  COUNTRY_COOKIE_NAME,
  LOGIN_PATH,
  parseAuthToken,
  parseCountryCookie,
} from "./session-cookies";
import type { CountryCode } from "./types";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME, COUNTRY_COOKIE_NAME, LOGIN_PATH };

// ─── Cookie Utilities ────────────────────────────────────────────────────────

/**
 * Read the auth token from the request's cookies.
 * Returns null if the cookie is missing or empty.
 */
export function readAuthToken(request: NextRequest): string | null {
  return parseAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

/**
 * Read the selected country code from the request's cookies.
 * Falls back to DEFAULT_COUNTRY_CODE if the cookie is missing or invalid.
 */
export function readCountryCode(request: NextRequest): CountryCode {
  return parseCountryCookie(request.cookies.get(COUNTRY_COOKIE_NAME)?.value);
}

export function setAuthCookie(response: NextResponse, authToken: string): void {
  response.cookies.set(AUTH_COOKIE_NAME, authToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function setCountryCookie(response: NextResponse, countryCode: CountryCode): void {
  response.cookies.set(COUNTRY_COOKIE_NAME, countryCode, {
    httpOnly: false,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function applyNoStore<T>(response: NextResponse<T>): NextResponse<T> {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
