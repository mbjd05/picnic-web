import type { Hono } from "hono";

import {
  loginWithCredentialsService,
  loginWithTokenService,
  resolveAuthCountryCode,
  resolveTwoFactorChannel,
  verify2FAService,
} from "@/lib/api-services/auth";
import {
  authCredentialsLoginSchema,
  authTokenLoginSchema,
  switchCountrySchema,
  twoFactorVerifySchema,
  validateInput,
} from "@/lib/api/validation";

import { authJson } from "../lib/http";
import {
  applyAuthResultCookies,
  clearAuthCookie,
  readSession,
  switchSessionCountry,
} from "../lib/session";

export function registerAuthRoutes(app: Hono): void {
  app.get("/api/dev/login-from-env", async (c) => {
    const url = new URL(c.req.url);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      return authJson(c, { success: false, error: "TOKEN_INVALID" }, 404);
    }

    const env = c.env as Record<string, string | undefined>;
    const token = env.PICNIC_TOKEN?.trim() || process.env.PICNIC_TOKEN?.trim();
    if (!token) {
      return c.text("Missing local PICNIC_TOKEN.", 500);
    }

    const { countryCode } = readSession(c);
    const result = await loginWithTokenService(
      token,
      resolveAuthCountryCode(env.PICNIC_COUNTRY_CODE, countryCode)
    );

    applyAuthResultCookies(c, result);
    if (result.body.success) return c.redirect("/");

    return c.text("Local PICNIC_TOKEN could not be used for login.", 401);
  });

  app.post("/api/auth/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const { countryCode } = readSession(c);
    const validation = validateInput(authTokenLoginSchema, body);
    const result = await loginWithTokenService(
      validation.ok ? validation.data.token : undefined,
      resolveAuthCountryCode(validation.ok ? validation.data.countryCode : undefined, countryCode),
      resolveTwoFactorChannel(validation.ok ? validation.data.twoFactorChannel : undefined)
    );

    applyAuthResultCookies(c, result);
    return authJson(c, result.body, result.status);
  });

  app.post("/api/auth/login-credentials", async (c) => {
    const body = await c.req.json().catch(() => null);
    const { countryCode } = readSession(c);
    const validation = validateInput(authCredentialsLoginSchema, body);
    const result = await loginWithCredentialsService(
      validation.ok ? validation.data.email : undefined,
      validation.ok ? validation.data.password : undefined,
      resolveAuthCountryCode(validation.ok ? validation.data.countryCode : undefined, countryCode),
      resolveTwoFactorChannel(validation.ok ? validation.data.twoFactorChannel : undefined)
    );

    applyAuthResultCookies(c, result);
    return authJson(c, result.body, result.status);
  });

  app.post("/api/auth/verify-2fa", async (c) => {
    const body = await c.req.json().catch(() => null);
    const { countryCode } = readSession(c);
    const validation = validateInput(twoFactorVerifySchema, body);
    const result = await verify2FAService(
      validation.ok ? validation.data.partialToken : undefined,
      validation.ok ? validation.data.code : undefined,
      countryCode
    );

    applyAuthResultCookies(c, result);
    return authJson(c, result.body, result.status);
  });

  app.post("/api/auth/logout", (c) => {
    clearAuthCookie(c);
    return authJson(c, { success: true });
  });

  app.post("/api/auth/switch-country", async (c) => {
    const body = await c.req.json().catch(() => null);
    const { countryCode } = readSession(c);
    const validation = validateInput(switchCountrySchema, body);
    const targetCountryCode = resolveAuthCountryCode(
      validation.ok ? validation.data.countryCode : undefined,
      countryCode
    );

    return c.json({
      success: true,
      countryCode: targetCountryCode,
      authenticated: switchSessionCountry(c, targetCountryCode),
    });
  });
}
