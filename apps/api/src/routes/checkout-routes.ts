import type { Hono } from "hono";

import {
  cancelCheckoutService,
  getCheckoutStatusService,
  startCheckoutPaymentService,
} from "@/lib/api-services/payments";

import { authenticatedJson } from "../lib/authenticated-handler";
import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

export function registerCheckoutRoutes(app: Hono): void {
  app.post("/api/checkout/start-payment", async (c) => {
    const appReturnUrl = new URL("/cart/payment-return", c.req.url).toString();
    return authenticatedJson(c, ({ token, countryCode }) =>
      startCheckoutPaymentService(token, countryCode, appReturnUrl)
    );
  });

  app.post("/api/checkout/cancel", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const result = await cancelCheckoutService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/checkout/status/:transactionId", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getCheckoutStatusService(token, countryCode, c.req.param("transactionId"))
    );
  });
}
