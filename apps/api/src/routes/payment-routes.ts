import type { Hono } from "hono";

import {
  createPaymentOptionService,
  getPaymentProfileService,
  removePaymentOptionService,
} from "@/lib/api-services/payments";

import { authenticatedJson } from "../lib/authenticated-handler";
import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

export function registerPaymentRoutes(app: Hono): void {
  app.get("/api/account/payment-profile", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getPaymentProfileService(token, countryCode)
    );
  });

  app.post("/api/account/payment-profile", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const result = await createPaymentOptionService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/account/payment-profile/payment-options", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const result = await createPaymentOptionService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.delete("/api/account/payment-profile/payment-options/:paymentOptionId", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      removePaymentOptionService(token, countryCode, c.req.param("paymentOptionId"))
    );
  });
}
