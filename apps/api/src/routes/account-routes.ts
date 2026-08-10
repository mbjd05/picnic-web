import type { Hono } from "hono";

import {
  getAccountProfileService,
  updateConsentSettingsService,
  updateHouseholdDetailsService,
} from "@/lib/api-services/account";

import { authenticatedJson } from "../lib/authenticated-handler";
import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

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

  app.put("/api/account/consents", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) return authRequiredResponse(c);

    const body = await c.req.json().catch(() => null);
    const result = await updateConsentSettingsService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });
}
