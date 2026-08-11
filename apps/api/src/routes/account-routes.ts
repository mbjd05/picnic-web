import type { Hono } from "hono";

import {
  getAddressSpecificationService,
  getAddressSuggestionsService,
  getAccountProfileService,
  getAvatarOptionsService,
  retrieveAddressService,
  updateAddressSpecificationService,
  updateAccountNameService,
  updateAvatarService,
  updateConsentSettingsService,
  updateHouseholdDetailsService,
  updateSelectedAddressService,
  uploadAvatarService,
} from "@/lib/api-services/account";

import { authenticatedJson } from "../lib/authenticated-handler";
import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;

export function registerAccountRoutes(app: Hono): void {
  app.get("/api/account/profile", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getAccountProfileService(token, countryCode)
    );
  });

  app.put("/api/account/household", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const body = await c.req.json().catch(() => null);
    const result = await updateHouseholdDetailsService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.put("/api/account/name", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const body = await c.req.json().catch(() => null);
    const result = await updateAccountNameService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/account/avatar-options", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getAvatarOptionsService(token, countryCode)
    );
  });

  app.put("/api/account/avatar", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const body = await c.req.json().catch(() => null);
    const result = await updateAvatarService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/account/avatar-upload", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const formData = await c.req.formData().catch(() => null);
    const file = formData?.get("avatar");
    if (!(file instanceof File)) {
      return c.json({ error: "Missing avatar image" }, 400);
    }
    if (file.size === 0 || file.size > MAX_AVATAR_UPLOAD_BYTES) {
      return c.json({ error: "Avatar image must be between 1 byte and 5 MB" }, 400);
    }

    const result = await uploadAvatarService(token, countryCode, {
      bytes: await file.arrayBuffer(),
      contentType: file.type || "image/jpeg",
    });
    return c.json(result.body, jsonStatus(result.status));
  });

  app.put("/api/account/consents", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const body = await c.req.json().catch(() => null);
    const result = await updateConsentSettingsService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/account/address/suggestions", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const result = await getAddressSuggestionsService(countryCode, c.req.query("q") ?? "");
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/account/address/retrieve", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const body = await c.req.json().catch(() => null);
    const result = await retrieveAddressService(countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.put("/api/account/address", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const body = await c.req.json().catch(() => null);
    const result = await updateSelectedAddressService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/account/address-specification", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getAddressSpecificationService(token, countryCode, c.req.query("addressId") ?? null)
    );
  });

  app.put("/api/account/address-specification", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const body = await c.req.json().catch(() => null);
    const result = await updateAddressSpecificationService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });
}
