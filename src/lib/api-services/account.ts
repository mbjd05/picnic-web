import {
  consentSettingsUpdateSchema,
  householdDetailsSchema,
  validateInput,
} from "@/lib/api/validation";
import { isApiTokenExpiredError } from "@/lib/api/error";
import { buildPicnicClient } from "@/lib/picnic/client";
import type {
  AccountConsentUpdateResponse,
  AccountHouseholdUpdateResponse,
  AccountProfileResponse,
} from "@/types/account";
import type { ApiErrorResponse } from "@/types/api";
import type { CountryCode } from "@/types/locale";

import type { ApiServiceResult } from "./types";

type AccountClient = {
  sendRequest: (
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    data?: unknown,
    includePicnicHeaders?: boolean
  ) => Promise<unknown>;
  user: {
    getUserDetails: () => Promise<unknown>;
    getUserInfo: () => Promise<unknown>;
    getProfileMenu: () => Promise<unknown>;
  };
  consent: {
    getConsentSettings: (general?: boolean) => Promise<unknown>;
    setConsentSettings: (input: unknown) => Promise<unknown>;
  };
};

function accountError(error: unknown, context: string): ApiServiceResult<ApiErrorResponse> {
  if (isApiTokenExpiredError(error)) {
    return {
      body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
      status: 401,
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error occurred";
  console.error(`[account service] ${context}:`, message);

  return {
    body: { error: "Could not load account details. Please try again later." },
    status: 502,
  };
}

export async function updateHouseholdDetailsService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<AccountHouseholdUpdateResponse | ApiErrorResponse>> {
  const validation = validateInput(householdDetailsSchema, rawBody);
  if (!validation.ok) {
    return { body: { error: validation.error }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as AccountClient;
    await client.sendRequest("POST", "/user-onboarding/household-details", validation.data, true);
    const user = await client.user.getUserDetails();
    return { body: { user: asRecord(user) } as AccountHouseholdUpdateResponse };
  } catch (error) {
    return accountError(error, "Failed to update household details");
  }
}

export async function updateConsentSettingsService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<AccountConsentUpdateResponse | ApiErrorResponse>> {
  const validation = validateInput(consentSettingsUpdateSchema, rawBody);
  if (!validation.ok) {
    return { body: { error: validation.error }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as AccountClient;
    const result = await client.consent.setConsentSettings(validation.data);
    const [consentSettings, generalConsentSettings] = await Promise.all([
      client.consent.getConsentSettings(),
      client.consent.getConsentSettings(true),
    ]);
    return {
      body: {
        result: asRecord(result),
        consentSettings: asArray(consentSettings),
        generalConsentSettings: asArray(generalConsentSettings),
      } as AccountConsentUpdateResponse,
    };
  } catch (error) {
    return accountError(error, "Failed to update consent settings");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function getAccountProfileService(
  authToken: string,
  countryCode: CountryCode
): Promise<ApiServiceResult<AccountProfileResponse | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as AccountClient;
    const [user, userInfo, profileMenu, consentSettings, generalConsentSettings] =
      await Promise.all([
        client.user.getUserDetails(),
        client.user.getUserInfo(),
        client.user.getProfileMenu(),
        client.consent.getConsentSettings(),
        client.consent.getConsentSettings(true),
      ]);

    return {
      body: {
        user: asRecord(user),
        userInfo: asRecord(userInfo),
        profileMenu: asRecord(profileMenu),
        consentSettings: asArray(consentSettings),
        generalConsentSettings: asArray(generalConsentSettings),
      } as AccountProfileResponse,
    };
  } catch (error) {
    return accountError(error, "Failed to fetch account profile");
  }
}
