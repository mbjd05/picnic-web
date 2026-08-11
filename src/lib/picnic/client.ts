import PicnicClient from "picnic-api";

import { parsePicnicDeviceId } from "@/lib/auth/picnic-token";
import type { CountryCode } from "@/types/locale";
import { DEFAULT_COUNTRY_CODE } from "@/types/locale";

const PICNIC_API_VERSION = "17";

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
  countryCode: CountryCode = DEFAULT_COUNTRY_CODE,
  apiVersion: string = PICNIC_API_VERSION
): PicnicClientInstance {
  const deviceId = parsePicnicDeviceId(authToken);
  return new PicnicClient({
    countryCode,
    apiVersion,
    authKey: authToken,
    ...(deviceId ? { deviceId } : {}),
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
