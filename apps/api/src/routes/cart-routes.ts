import type { Hono } from "hono";

import {
  getCartService,
  getDeliverySlotsService,
  mutateCartService,
  setDeliverySlotService,
} from "@/lib/api-services/cart";

import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

export function registerCartRoutes(app: Hono): void {
  app.get("/api/cart", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getCartService(token, countryCode);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/cart", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const result = await mutateCartService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/cart/delivery-slots", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getDeliverySlotsService(token, countryCode);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/cart/delivery-slots", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const result = await setDeliverySlotService(token, countryCode, body);
    return c.json(result.body, jsonStatus(result.status));
  });
}
