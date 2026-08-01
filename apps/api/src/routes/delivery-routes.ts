import type { Hono } from "hono";

import {
  cancelDeliveryService,
  getDeliveryDetailService,
  getDeliveryOrderStatusService,
  getDeliverySummariesService,
  getDeliveryTrackingService,
  sendDeliveryInvoiceEmailService,
  setDeliveryRatingService,
} from "@/lib/api-services/deliveries";
import { deliveryRatingSchema, validateInput } from "@/lib/api-validation";

import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

export function registerDeliveryRoutes(app: Hono): void {
  app.get("/api/deliveries", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const statuses = (c.req.queries("status") ?? [])
      .flatMap((status) => status.split(","))
      .map((status) => status.trim().toUpperCase())
      .filter(Boolean);
    const result = await getDeliverySummariesService(token, countryCode, statuses);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/deliveries/:deliveryId", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getDeliveryDetailService(token, countryCode, c.req.param("deliveryId"));
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/deliveries/:deliveryId/tracking", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getDeliveryTrackingService(token, countryCode, c.req.param("deliveryId"));
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/orders/:orderId/status", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getDeliveryOrderStatusService(token, countryCode, c.req.param("orderId"));
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/deliveries/:deliveryId/cancel", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await cancelDeliveryService(token, countryCode, c.req.param("deliveryId"));
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/deliveries/:deliveryId/rating", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const body = await c.req.json().catch(() => null);
    const validation = validateInput(deliveryRatingSchema, body);
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }

    const result = await setDeliveryRatingService(
      token,
      countryCode,
      c.req.param("deliveryId"),
      validation.data.rating
    );
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/deliveries/:deliveryId/invoice-email", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await sendDeliveryInvoiceEmailService(
      token,
      countryCode,
      c.req.param("deliveryId")
    );
    return c.json(result.body, jsonStatus(result.status));
  });
}
