export const SUPPORTED_COUNTRY_CODES = ["NL", "DE", "FR"] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];
export const DEFAULT_COUNTRY_CODE: CountryCode = "NL";

export const SUPPORTED_LANGUAGE_CODES = ["EN", "NL", "DE", "FR"] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];
export const DEFAULT_LANGUAGE_CODE: LanguageCode = "NL";

/** Cookie name for the selected Picnic country. */
export const COUNTRY_COOKIE_NAME = "picnic_country";

/** Cookie name for the selected display language. */
export const LANGUAGE_COOKIE_NAME = "picnic_language";

/** Build the Picnic image CDN base URL for a given country. */
export function getImageCdnBase(countryCode: CountryCode): string {
  return `https://storefront-prod.${countryCode.toLowerCase()}.picnicinternational.com/static/images`;
}

/** Validate a raw string value as a CountryCode, falling back to the default. */
export function parseCountryCode(value: string | undefined): CountryCode {
  const upper = value?.toUpperCase();
  if (upper && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(upper)) {
    return upper as CountryCode;
  }
  return DEFAULT_COUNTRY_CODE;
}
