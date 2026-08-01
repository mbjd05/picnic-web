import { COUNTRY_COOKIE_NAME, DEFAULT_COUNTRY_CODE, SUPPORTED_COUNTRY_CODES } from "@/types/locale";
import type { CountryCode } from "@/types/locale";

/** Cookie name for the Picnic auth token. */
export const AUTH_COOKIE_NAME = "picnic_auth_token";

/** Cookie name prefix for region-scoped Picnic auth tokens. */
export const REGION_AUTH_COOKIE_PREFIX = `${AUTH_COOKIE_NAME}_`;

/** Cookie max-age in seconds (30 days). */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Path to the login page. */
export const LOGIN_PATH = "/login";

export { COUNTRY_COOKIE_NAME };

export function authCookieNameForCountry(countryCode: CountryCode): string {
  return `${REGION_AUTH_COOKIE_PREFIX}${countryCode.toLowerCase()}`;
}

export function parseAuthToken(value: string | undefined | null): string | null {
  if (!value || value.trim() === "") {
    return null;
  }
  return value;
}

export function parseCountryCookie(value: string | undefined | null): CountryCode {
  const upper = value?.toUpperCase();
  if (upper && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(upper)) {
    return upper as CountryCode;
  }
  return DEFAULT_COUNTRY_CODE;
}
