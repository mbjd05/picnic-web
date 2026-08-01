import type { Hono } from "hono";

import { getCookbookService, searchCookbookService } from "@/lib/api-services/cookbook";
import {
  addRecipeToCartService,
  getCookbookCountsService,
  getRecipeDetailService,
  updateSavedRecipeService,
} from "@/lib/api-services/recipes";

import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

export function registerRecipeRoutes(app: Hono): void {
  app.get("/api/cookbook/counts", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getCookbookCountsService(token, countryCode);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/cookbook", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getCookbookService(token, countryCode, c.req.query("category") ?? null);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/cookbook/search", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const query = c.req.query("q")?.trim() ?? "";
    const result = await searchCookbookService(token, countryCode, query);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/recipe/:id/saved", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await updateSavedRecipeService(token, countryCode, c.req.param("id"), true);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.delete("/api/recipe/:id/saved", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await updateSavedRecipeService(token, countryCode, c.req.param("id"), false);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.post("/api/recipe/:id/add-to-cart", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const result = await addRecipeToCartService(token, countryCode, c.req.param("id"), body);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/recipe/:id", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getRecipeDetailService(
      token,
      countryCode,
      c.req.param("id"),
      c.req.query("portions") ?? null
    );
    return c.json(result.body, jsonStatus(result.status));
  });
}
