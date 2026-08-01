import type { Hono } from "hono";

import { getCategoriesService } from "@/lib/api-services/categories";
import { getCategoryProductsService, getSubcategoriesService } from "@/lib/api-services/products";

import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

export function registerCategoryRoutes(app: Hono): void {
  app.get("/api/categories", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getCategoriesService(token, countryCode);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/categories/:categoryId/subcategories", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getSubcategoriesService(token, countryCode, c.req.param("categoryId"));
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/categories/:categoryId/products", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getCategoryProductsService(token, countryCode, c.req.param("categoryId"));
    return c.json(result.body, jsonStatus(result.status));
  });
}
