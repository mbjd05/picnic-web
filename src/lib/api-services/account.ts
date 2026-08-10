import { isApiTokenExpiredError } from "@/lib/api/error";
import { buildPicnicClient } from "@/lib/picnic/client";
import type { AccountProfileResponse } from "@/types/account";
import type { ApiErrorResponse } from "@/types/api";
import type { CountryCode } from "@/types/locale";

import type { ApiServiceResult } from "./types";

type AccountClient = {
  user: {
    getUserDetails: () => Promise<unknown>;
    getUserInfo: () => Promise<unknown>;
    getProfileMenu: () => Promise<unknown>;
  };
  consent: {
    getConsentSettings: (general?: boolean) => Promise<unknown>;
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
