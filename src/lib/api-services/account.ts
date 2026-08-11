import {
  accountNameSchema,
  addressRetrieveSchema,
  addressSpecificationSchema,
  addressUpdateSchema,
  avatarUpdateSchema,
  consentSettingsUpdateSchema,
  householdDetailsSchema,
  validateInput,
} from "@/lib/api/validation";
import { isApiTokenExpiredError } from "@/lib/api/error";
import { buildPicnicClient } from "@/lib/picnic/client";
import type {
  AccountConsentUpdateResponse,
  AccountHouseholdUpdateResponse,
  AccountAvatarOptionsResponse,
  AccountAvatarUpdateResponse,
  AccountNameUpdateResponse,
  AccountProfileResponse,
  AddressRetrieveResponse,
  AddressSpecificationResponse,
  AddressSuggestionsResponse,
  AddressUpdateResponse,
  RetrievedAddress,
} from "@/types/account";
import type { ApiErrorResponse } from "@/types/api";
import type { CountryCode } from "@/types/locale";

import type { ApiServiceResult } from "./types";

const PUBLIC_ADDRESS_API_VERSION = "15";
const ADDRESS_SPECIFICATION_API_VERSION = "15";
const PROFILE_MENU_API_VERSION = "15";
const USER_PROFILE_API_VERSION = "15";
const ALLOWED_AVATAR_CONTENT_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;
const PUBLIC_ADDRESS_CLIENT = {
  client_id: "30100",
  client_version: "1.228.1",
  device_id: "PICNICWEBADDRESS1",
  device_name: "Picnic Web",
} as const;

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
  userOnboarding: {
    setHouseholdDetails: (input: unknown) => Promise<unknown>;
  };
};

type RawAvatarOption = {
  image_id?: unknown;
  image_url?: unknown;
  name?: unknown;
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
    await client.userOnboarding.setHouseholdDetails(validation.data);
    const user = await client.user.getUserDetails();
    return { body: { user: asRecord(user) } as AccountHouseholdUpdateResponse };
  } catch (error) {
    return accountError(error, "Failed to update household details");
  }
}

export async function updateAccountNameService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<AccountNameUpdateResponse | ApiErrorResponse>> {
  const validation = validateInput(accountNameSchema, rawBody);
  if (!validation.ok) return { body: { error: validation.error }, status: 400 };

  try {
    const writeClient = buildPicnicClient(
      authToken,
      countryCode,
      USER_PROFILE_API_VERSION
    ) as unknown as AccountClient;
    await writeClient.sendRequest(
      "POST",
      "/user",
      {
        firstname: validation.data.firstname,
        lastname: validation.data.lastname?.trim() ?? "",
      },
      true
    );
    const readClient = buildPicnicClient(authToken, countryCode) as unknown as AccountClient;
    const [user, profileMenu] = await Promise.all([
      readClient.user.getUserDetails(),
      readClient.user.getProfileMenu(),
    ]);

    return {
      body: {
        user: asRecord(user),
        profileMenu: asRecord(profileMenu),
      } as AccountNameUpdateResponse,
    };
  } catch (error) {
    return accountError(error, "Failed to update account name");
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
    const result = await client.consent.setConsentSettings({
      ...validation.data,
      general_consent: validation.data.general_consent ?? false,
    });
    const [user, consentSettings, generalConsentSettings] = await Promise.all([
      client.user.getUserDetails(),
      client.consent.getConsentSettings(),
      client.consent.getConsentSettings(true),
    ]);
    return {
      body: {
        result: asRecord(result),
        user: asRecord(user),
        consentSettings: asArray(consentSettings),
        generalConsentSettings: asArray(generalConsentSettings),
      } as AccountConsentUpdateResponse,
    };
  } catch (error) {
    return accountError(error, "Failed to update consent settings");
  }
}

export async function getAvatarOptionsService(
  authToken: string,
  countryCode: CountryCode
): Promise<ApiServiceResult<AccountAvatarOptionsResponse | ApiErrorResponse>> {
  try {
    const avatars = await profileMenuRequest(
      authToken,
      countryCode,
      "GET",
      "/profile-menu/avatars"
    );

    return {
      body: {
        avatars: asArray(avatars)
          .map(parseAvatarOption)
          .filter((avatar): avatar is AccountAvatarOptionsResponse["avatars"][number] =>
            Boolean(avatar)
          ),
      },
    };
  } catch (error) {
    return accountError(error, "Failed to fetch avatar options");
  }
}

export async function updateAvatarService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<AccountAvatarUpdateResponse | ApiErrorResponse>> {
  const validation = validateInput(avatarUpdateSchema, rawBody);
  if (!validation.ok) return { body: { error: validation.error }, status: 400 };

  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as AccountClient;
    const avatar = await profileMenuRequest(
      authToken,
      countryCode,
      "PUT",
      "/profile-menu/avatar",
      validation.data
    );
    const profileMenu = await client.user.getProfileMenu();

    return {
      body: {
        avatar: asRecord(avatar),
        profileMenu: asRecord(profileMenu),
      } as AccountAvatarUpdateResponse,
    };
  } catch (error) {
    return accountError(error, "Failed to update avatar");
  }
}

export async function uploadAvatarService(
  authToken: string,
  countryCode: CountryCode,
  image: { bytes: ArrayBuffer; contentType: string }
): Promise<ApiServiceResult<AccountAvatarUpdateResponse | ApiErrorResponse>> {
  if (!ALLOWED_AVATAR_CONTENT_TYPES.has(image.contentType)) {
    return { body: { error: "Invalid image type" }, status: 400 };
  }
  if (image.bytes.byteLength === 0 || image.bytes.byteLength > MAX_AVATAR_UPLOAD_BYTES) {
    return { body: { error: "Avatar image must be between 1 byte and 5 MB" }, status: 400 };
  }

  try {
    const upload = asRecord(
      await profileMenuBinaryRequest(
        authToken,
        countryCode,
        "/images/CUSTOMER_AVATAR",
        image.bytes,
        image.contentType
      )
    );
    const imageId = upload.id;
    if (typeof imageId !== "string" || !imageId) {
      return { body: { error: "Picnic did not return an avatar image id." }, status: 502 };
    }

    return updateAvatarService(authToken, countryCode, {
      type: "USER_DEFINED",
      image_id: imageId,
    });
  } catch (error) {
    return accountError(error, "Failed to upload avatar");
  }
}

export async function getAddressSuggestionsService(
  countryCode: CountryCode,
  query: string
): Promise<ApiServiceResult<AddressSuggestionsResponse | ApiErrorResponse>> {
  const input = query.trim();
  if (input.length < 3) return { body: { suggestions: [] } };

  try {
    const response = await publicAddressRequest(countryCode, "suggest-address", {
      ...PUBLIC_ADDRESS_CLIENT,
      input,
    });

    return {
      body: {
        suggestions: asArray((response as { results?: unknown[] }).results),
      } as AddressSuggestionsResponse,
    };
  } catch (error) {
    return accountError(error, "Failed to fetch address suggestions");
  }
}

export async function retrieveAddressService(
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<AddressRetrieveResponse | ApiErrorResponse>> {
  const validation = validateInput(addressRetrieveSchema, rawBody);
  if (!validation.ok) return { body: { error: validation.error }, status: 400 };

  try {
    const retrieved = (await publicAddressRequest(countryCode, "retrieve-address", {
      ...PUBLIC_ADDRESS_CLIENT,
      address_id: validation.data.addressId,
    })) as { address?: RetrievedAddress };

    if (!retrieved.address) {
      return { body: { error: "Address not found" }, status: 404 };
    }

    const registrationProperties = await publicAddressRequest(
      countryCode,
      "registration-properties",
      { address: retrieved.address }
    );

    return {
      body: {
        address: retrieved.address,
        registrationProperties: asRecord(registrationProperties),
      } as AddressRetrieveResponse,
    };
  } catch (error) {
    return accountError(error, "Failed to retrieve address");
  }
}

export async function updateSelectedAddressService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<AddressUpdateResponse | ApiErrorResponse>> {
  const validation = validateInput(addressUpdateSchema, rawBody);
  if (!validation.ok) return { body: { error: validation.error }, status: 400 };

  try {
    const writeClient = buildPicnicClient(
      authToken,
      countryCode,
      USER_PROFILE_API_VERSION
    ) as unknown as AccountClient;
    await writeClient.sendRequest(
      "POST",
      "/user",
      { selected_address: { address: validation.data.address } },
      true
    );
    const readClient = buildPicnicClient(authToken, countryCode) as unknown as AccountClient;
    const user = await getUserDetailsAfterAddressUpdate(readClient, validation.data.address);

    if (!addressMatchesUser(validation.data.address, asRecord(user.address))) {
      console.warn("[account service] Address update was accepted but user details lagged behind.");
      return {
        body: { user: withSelectedAddress(user, validation.data.address) } as AddressUpdateResponse,
      };
    }

    return { body: { user } as AddressUpdateResponse };
  } catch (error) {
    return accountError(error, "Failed to update selected address");
  }
}

export async function getAddressSpecificationService(
  authToken: string,
  countryCode: CountryCode,
  addressId: string | null
): Promise<ApiServiceResult<AddressSpecificationResponse | ApiErrorResponse>> {
  if (!addressId) return { body: { error: "Missing addressId parameter" }, status: 400 };

  try {
    const [specifications, enabledFields] = await Promise.all([
      addressSpecificationRequest(
        authToken,
        countryCode,
        "GET",
        `/address-specifications/${encodeURIComponent(addressId)}`
      ),
      addressSpecificationRequest(
        authToken,
        countryCode,
        "GET",
        "/address-specifications/enabled-fields"
      ),
    ]);

    return {
      body: {
        specifications: asArray(specifications),
        enabledFields: asArray(enabledFields).filter(
          (field): field is string => typeof field === "string"
        ),
      } as AddressSpecificationResponse,
    };
  } catch (error) {
    return accountError(error, "Failed to fetch address specification");
  }
}

export async function updateAddressSpecificationService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<AddressSpecificationResponse | ApiErrorResponse>> {
  const validation = validateInput(addressSpecificationSchema, rawBody);
  if (!validation.ok) return { body: { error: validation.error }, status: 400 };

  const spec = validation.data.addressSpecification;
  const payload = {
    address_id: validation.data.addressId,
    delivery_instruction: emptyToNull(validation.data.deliveryInstruction),
    address_specification: {
      access_codes: spec.accessCodes ?? [],
      building_type: emptyToNull(spec.buildingType),
      building_identifier: emptyToNull(spec.buildingIdentifier),
      floor: spec.floor ?? null,
      front_door_guidance: emptyToNull(spec.frontDoorGuidance),
      elevator: spec.elevator ?? null,
    },
  };

  try {
    await addressSpecificationRequest(
      authToken,
      countryCode,
      "POST",
      "/address-specifications",
      payload
    );
    try {
      const readback = await getAddressSpecificationService(
        authToken,
        countryCode,
        validation.data.addressId
      );
      if (!readback.status || readback.status < 400) return readback;
      console.warn(
        "[account service] Address specification update was accepted but readback failed."
      );
    } catch (readbackError) {
      const message =
        readbackError instanceof Error ? readbackError.message : "Unknown readback error";
      console.warn(
        "[account service] Address specification update was accepted but readback threw:",
        message
      );
    }

    return {
      body: optimisticAddressSpecificationResponse(payload),
    };
  } catch (error) {
    return accountError(error, "Failed to update address specification");
  }
}

function optimisticAddressSpecificationResponse(payload: {
  address_id: string;
  delivery_instruction: string | null;
  address_specification: {
    building_type: string | null;
    building_identifier: string | null;
    floor: number | null;
    front_door_guidance: string | null;
    elevator: boolean | null;
  };
}): AddressSpecificationResponse {
  return {
    enabledFields: [
      "delivery_instruction",
      "building_type",
      "building_identifier",
      "floor",
      "front_door_guidance",
      "elevator",
    ],
    specifications: [
      {
        address_id: payload.address_id,
        delivery_instruction: payload.delivery_instruction,
        address_specification: payload.address_specification,
      },
    ],
  };
}

function parseAvatarOption(value: unknown): AccountAvatarOptionsResponse["avatars"][number] | null {
  const option = value as RawAvatarOption;
  if (
    !option ||
    typeof option !== "object" ||
    typeof option.image_id !== "string" ||
    typeof option.image_url !== "string"
  ) {
    return null;
  }

  return {
    image_id: option.image_id,
    image_url: option.image_url,
    name: typeof option.name === "string" ? option.name : null,
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

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function addressMatchesUser(
  address: RetrievedAddress,
  userAddress: Record<string, unknown>
): boolean {
  return (
    normalized(userAddress.street) === normalized(address.street) &&
    normalized(userAddress.city) === normalized(address.city) &&
    normalizedPostcode(userAddress.postcode) === normalizedPostcode(address.postcode) &&
    Number(userAddress.house_number) === address.house_number &&
    normalized(userAddress.house_number_ext) === normalized(address.house_number_ext)
  );
}

async function getUserDetailsAfterAddressUpdate(
  client: AccountClient,
  address: RetrievedAddress
): Promise<Record<string, unknown>> {
  let user = asRecord(await client.user.getUserDetails());
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (addressMatchesUser(address, asRecord(user.address))) return user;
    await sleep(250);
    user = asRecord(await client.user.getUserDetails());
  }
  return user;
}

function withSelectedAddress(
  user: Record<string, unknown>,
  address: RetrievedAddress
): Record<string, unknown> {
  return {
    ...user,
    address: {
      ...asRecord(user.address),
      id: address.id,
      house_number: address.house_number,
      house_number_ext: address.house_number_ext ?? null,
      postcode: address.postcode,
      street: address.street,
      city: address.city,
    },
  };
}

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizedPostcode(value: unknown): string {
  return normalized(value).replace(/\s+/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function addressSpecificationRequest(
  authToken: string,
  countryCode: CountryCode,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<unknown> {
  const client = buildPicnicClient(authToken, countryCode, ADDRESS_SPECIFICATION_API_VERSION);
  return client.sendRequest(method, path, body ?? null, true);
}

async function profileMenuRequest(
  authToken: string,
  countryCode: CountryCode,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown
): Promise<unknown> {
  const client = buildPicnicClient(authToken, countryCode, PROFILE_MENU_API_VERSION);
  return client.sendRequest(method, path, body ?? null, true);
}

async function profileMenuBinaryRequest(
  authToken: string,
  countryCode: CountryCode,
  path: string,
  body: ArrayBuffer,
  contentType: string
): Promise<unknown> {
  const client = buildPicnicClient(authToken, countryCode, PROFILE_MENU_API_VERSION);
  const response = await fetch(`${client.url}${path}`, {
    method: "POST",
    headers: {
      ...client.baseHeaders,
      ...client.picnicHeaders,
      "Content-Type": contentType,
    },
    body,
  });

  return parsePicnicJsonResponse(response, "Profile image upload failed");
}

async function parsePicnicJsonResponse(response: Response, context: string): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${context}: HTTP ${response.status}`);
  }

  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    // Do not include raw upstream payloads in errors because accountError logs the message.
    throw new Error(`${context}: invalid JSON response`);
  }
}

function publicAddressBaseUrl(countryCode: CountryCode): string {
  return `https://storefront-prod.${countryCode.toLowerCase()}.picnicinternational.com/public-api/${PUBLIC_ADDRESS_API_VERSION}/user-onboarding`;
}

async function publicAddressRequest(
  countryCode: CountryCode,
  path: "suggest-address" | "retrieve-address" | "registration-properties",
  body: unknown
): Promise<unknown> {
  const response = await fetch(`${publicAddressBaseUrl(countryCode)}/${path}`, {
    method: "POST",
    headers: {
      "Accept-Language": countryCode === "DE" ? "de" : countryCode === "FR" ? "fr" : "nl",
      "Content-Type": "application/json; charset=UTF-8",
      "x-picnic-agent": "30100;1.228.1-15480;",
      "x-picnic-did": PUBLIC_ADDRESS_CLIENT.device_id,
    },
    body: JSON.stringify(body),
  });

  return parsePicnicJsonResponse(response, "Public address request failed");
}

export async function getAccountProfileService(
  authToken: string,
  countryCode: CountryCode
): Promise<ApiServiceResult<AccountProfileResponse | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as AccountClient;
    const [user, userInfo, profileMenu, currentAvatar, consentSettings, generalConsentSettings] =
      await Promise.all([
        client.user.getUserDetails(),
        client.user.getUserInfo(),
        client.user.getProfileMenu(),
        profileMenuRequest(authToken, countryCode, "GET", "/profile-menu/avatar"),
        client.consent.getConsentSettings(),
        client.consent.getConsentSettings(true),
      ]);

    return {
      body: {
        user: asRecord(user),
        userInfo: asRecord(userInfo),
        profileMenu: asRecord(profileMenu),
        currentAvatar: asRecord(currentAvatar),
        consentSettings: asArray(consentSettings),
        generalConsentSettings: asArray(generalConsentSettings),
      } as AccountProfileResponse,
    };
  } catch (error) {
    return accountError(error, "Failed to fetch account profile");
  }
}
