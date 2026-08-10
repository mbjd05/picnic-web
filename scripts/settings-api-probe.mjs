import { createHash } from "node:crypto";

import PicnicClient from "picnic-api";

import { loadLocalEnvFile } from "./local-env.mjs";

/*
Picnic user settings API probe
==============================

Default read/route-existence run:
  node .\scripts\settings-api-probe.mjs

Optional idempotent mutation confirmation:
  node .\scripts\settings-api-probe.mjs --confirm-idempotent-writes

The default mode avoids meaningful account changes. It summarizes response
shapes and status/error classes, and redacts personal values.
*/

loadLocalEnvFile();

const token = process.env.PICNIC_TOKEN;
const countryCode = process.env.PICNIC_COUNTRY_CODE ?? "NL";
const apiVersion = process.env.PICNIC_API_VERSION ?? "17";
const confirmIdempotentWrites = process.argv.includes("--confirm-idempotent-writes");
const includeAddressCandidateMatrix = process.argv.includes("--include-address-candidate-matrix");

if (!token) {
  console.error("PICNIC_TOKEN is missing. Run: node .\\scripts\\picnic-auth-probe.mjs login");
  process.exit(1);
}

const client = new PicnicClient({
  countryCode,
  apiVersion,
  authKey: token,
});

const baseUrl = `https://storefront-prod.${countryCode.toLowerCase()}.picnicinternational.com/api/${apiVersion}`;

function baseHeaders() {
  return {
    "User-Agent": "okhttp/4.9.0",
    "Content-Type": "application/json; charset=UTF-8",
    "Accept-Language": countryCode === "DE" ? "de" : countryCode === "FR" ? "fr" : "nl",
    "x-picnic-auth": token,
    "x-picnic-agent": "30100;1.236.1-15553;",
    "x-picnic-did": "3C417201548B2E3B",
  };
}

function summarize(value, depth = 0) {
  if (value === null) return null;
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      sample: value.length > 0 && depth < 2 ? summarize(value[0], depth + 1) : undefined,
    };
  }
  if (typeof value !== "object") return typeof value;

  const summary = {};
  for (const [key, child] of Object.entries(value)) {
    if (depth >= 2) {
      summary[key] = Array.isArray(child)
        ? `array(${child.length})`
        : child === null
          ? null
          : typeof child;
    } else {
      summary[key] = summarize(child, depth + 1);
    }
  }
  return summary;
}

async function rawRequest(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: baseHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text.slice(0, 240);
    }
  }

  return {
    method,
    path,
    status: response.status,
    statusText: response.statusText,
    bodySummary: parsed && typeof parsed === "object" ? summarize(parsed) : parsed,
    error:
      parsed && typeof parsed === "object" && "error" in parsed
        ? summarize(parsed.error)
        : typeof parsed === "string"
          ? parsed
          : undefined,
  };
}

async function printJson(label, value) {
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

async function readSurfaces() {
  const user = await client.user.getUserDetails();
  const userInfo = await client.user.getUserInfo();
  const profileMenu = await client.user.getProfileMenu();
  const consentSettings = await client.consent.getConsentSettings();
  const generalConsentSettings = await client.consent.getConsentSettings(true);

  await printJson("read surfaces", {
    tokenHashPrefix: createHash("sha256").update(token).digest("hex").slice(0, 12),
    countryCode,
    apiVersion,
    user: summarize(user),
    userInfo: summarize(userInfo),
    profileMenu: summarize(profileMenu),
    consentSettings: summarize(consentSettings),
    generalConsentSettings: summarize(generalConsentSettings),
  });

  return { user, userInfo, profileMenu, consentSettings, generalConsentSettings };
}

async function routeMatrix() {
  const probes = [
    ["GET", "/user"],
    ["PUT", "/user", {}],
    ["PATCH", "/user", {}],
    ["GET", "/user-info"],
    ["PUT", "/user-info", {}],
    ["GET", "/profile-menu?fetch_mgm=true"],
    ["GET", "/consents/settings-page"],
    ["PUT", "/consents", { consent_declarations: [] }],
    ["GET", "/consents/general/settings-page"],
    ["GET", "/consents/general"],
    ["PUT", "/consents/general", { general_consent: false, consent_declarations: [] }],
    ["POST", "/user-onboarding/household-details", {}],
    ["PUT", "/user-onboarding/household-details", {}],
    ["GET", "/user-onboarding/household-details"],
    ["POST", "/user-onboarding/business-details", {}],
    ["PUT", "/user-onboarding/business-details", {}],
    ["GET", "/user-onboarding/business-details"],
    ["POST", "/user-onboarding/subscribe-push", {}],
    ["GET", "/user-onboarding/subscribe-push"],
    ["POST", "/user/phone_verification/generate", {}],
    ["POST", "/user/phone_verification/verify", {}],
  ];

  const addressCandidates = includeAddressCandidateMatrix
    ? [
        "/address",
        "/addresses",
        "/user/address",
        "/user/addresses",
        "/user/address-change",
        "/user/address_change",
        "/user/move",
        "/user/relocation",
        "/user/delivery-address",
        "/user/delivery_address",
        "/user-onboarding/address",
        "/user-onboarding/check-address",
        "/user-onboarding/register-address",
        "/user-onboarding/update-address",
        "/address/check",
        "/address/autocomplete",
      ]
    : [];

  for (const path of addressCandidates) {
    probes.push(["GET", path]);
    probes.push(["POST", path, {}]);
    probes.push(["PUT", path, {}]);
  }

  const results = [];
  for (const [method, path, body] of probes) {
    results.push(await rawRequest(method, path, body));
  }

  await printJson("route matrix", results);
  return results;
}

async function idempotentWrites(surfaces) {
  if (!confirmIdempotentWrites) {
    await printJson("idempotent writes", {
      skipped: true,
      reason:
        "Pass --confirm-idempotent-writes to send current household/consent values back to Picnic.",
    });
    return;
  }

  const household = surfaces.user.household_details;
  const householdBody = household
    ? {
        adults: household.adults,
        children: household.children,
        cats: household.cats,
        dogs: household.dogs,
      }
    : null;

  const firstConsent = surfaces.consentSettings.find(
    (setting) =>
      setting &&
      typeof setting.text_id === "string" &&
      typeof setting.text_locale === "string" &&
      typeof setting.established_decision === "boolean"
  );
  const generalConsentDeclarations = surfaces.generalConsentSettings
    .filter(
      (setting) =>
        setting &&
        typeof setting.text_id === "string" &&
        typeof setting.text_locale === "string" &&
        typeof setting.established_decision === "boolean"
    )
    .map((setting) => ({
      consent_request_text_id: setting.text_id,
      consent_request_locale: setting.text_locale,
      agreement: setting.established_decision,
    }));

  const results = [];
  if (householdBody) {
    results.push(await rawRequest("POST", "/user-onboarding/household-details", householdBody));
    const afterUser = await client.user.getUserDetails();
    results.push({
      check: "household reflected on GET /user",
      sameValues:
        afterUser.household_details?.adults === householdBody.adults &&
        afterUser.household_details?.children === householdBody.children &&
        afterUser.household_details?.cats === householdBody.cats &&
        afterUser.household_details?.dogs === householdBody.dogs,
      afterSummary: summarize(afterUser.household_details),
    });
  }

  if (firstConsent) {
    results.push(
      await rawRequest("PUT", "/consents", {
        consent_declarations: [
          {
            consent_request_text_id: firstConsent.text_id,
            consent_request_locale: firstConsent.text_locale,
            agreement: firstConsent.established_decision,
          },
        ],
      })
    );
    const afterSettings = await client.consent.getConsentSettings();
    const afterMatch = afterSettings.find((setting) => setting.text_id === firstConsent.text_id);
    results.push({
      check: "consent reflected on GET /consents/settings-page",
      sameValue: afterMatch?.established_decision === firstConsent.established_decision,
      updatedTextId: firstConsent.text_id,
    });
  }

  if (generalConsentDeclarations.length > 0) {
    results.push(
      await rawRequest("PUT", "/consents/general", {
        general_consent: surfaces.user.check_general_consent === true,
        consent_declarations: generalConsentDeclarations,
      })
    );
    const afterGeneralSettings = await client.consent.getConsentSettings(true);
    results.push({
      check: "general consents reflected on GET /consents/general/settings-page",
      sameValues: generalConsentDeclarations.every((declaration) => {
        const afterMatch = afterGeneralSettings.find(
          (setting) => setting.text_id === declaration.consent_request_text_id
        );
        return afterMatch?.established_decision === declaration.agreement;
      }),
      updatedTextIds: generalConsentDeclarations.map(
        (declaration) => declaration.consent_request_text_id
      ),
    });
  }

  await printJson("idempotent writes", results);
}

const surfaces = await readSurfaces();
await routeMatrix();
await idempotentWrites(surfaces);
