import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { AuthServiceResult } from "@/lib/api-services/auth";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  COUNTRY_COOKIE_NAME,
  parseAuthToken,
  parseCountryCookie,
} from "@/lib/session-cookies";

export function readSession(c: Context) {
  const token = parseAuthToken(getCookie(c, AUTH_COOKIE_NAME));
  const countryCode = parseCountryCookie(getCookie(c, COUNTRY_COOKIE_NAME));
  return { token, countryCode };
}

function secureCookie(c: Context): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export function clearAuthCookie(c: Context): void {
  deleteCookie(c, AUTH_COOKIE_NAME, {
    secure: secureCookie(c),
    sameSite: "Strict",
    path: "/",
  });
}

export function applyAuthResultCookies(c: Context, result: AuthServiceResult): void {
  if (result.authToken) {
    setCookie(c, AUTH_COOKIE_NAME, result.authToken, {
      httpOnly: true,
      secure: secureCookie(c),
      sameSite: "Strict",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    });
  }

  if (result.countryCode) {
    setCookie(c, COUNTRY_COOKIE_NAME, result.countryCode, {
      httpOnly: false,
      secure: secureCookie(c),
      sameSite: "Lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    });
  }
}
