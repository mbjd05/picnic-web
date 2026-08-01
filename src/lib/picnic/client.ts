import { createRequire } from "node:module";

import type { CountryCode } from "@/types/locale";
import { DEFAULT_COUNTRY_CODE } from "@/types/locale";

const PICNIC_API_VERSION = "17";
const require = createRequire(import.meta.url);

/**
 * picnic-api uses `export = class PicnicClient` (CJS module.exports).
 * Use Node's ESM-safe createRequire to avoid CJS interop issues.
 */
const PicnicClient = require("picnic-api") as typeof import("picnic-api");

export type PicnicClientInstance = InstanceType<typeof PicnicClient>;

/**
 * Create a new PicnicClient instance with the given auth token.
 * Must only be called server-side (route handlers).
 *
 * Each call creates a fresh instance — no cached state.
 * PicnicClient construction is cheap (plain object, no I/O).
 */
export function buildPicnicClient(
  authToken: string,
  countryCode: CountryCode = DEFAULT_COUNTRY_CODE
): PicnicClientInstance {
  return new PicnicClient({
    countryCode,
    apiVersion: PICNIC_API_VERSION,
    authKey: authToken,
  });
}

/**
 * Create a new PicnicClient instance without an auth token.
 * Used for login-by-credentials where the authKey is not yet known.
 * Must only be called server-side (route handlers).
 */
export function buildPicnicClientAnonymous(
  countryCode: CountryCode = DEFAULT_COUNTRY_CODE
): PicnicClientInstance {
  return new PicnicClient({
    countryCode,
    apiVersion: PICNIC_API_VERSION,
  });
}
