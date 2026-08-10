import type { Hono } from "hono";

import { getCookbookService, searchCookbookService } from "@/lib/api-services/cookbook";
import {
  addRecipeToCartService,
  getCookbookCountsService,
  getRecipeDetailService,
  resolvePicnicLinkService,
  resolveRecipeReferenceService,
  updateSavedRecipeService,
} from "@/lib/api-services/recipes";

import { authenticatedJson } from "../lib/authenticated-handler";
import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

export function registerRecipeRoutes(app: Hono): void {
  app.get("/api/cookbook/counts", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getCookbookCountsService(token, countryCode)
    );
  });

  app.get("/api/cookbook", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getCookbookService(token, countryCode, c.req.query("category") ?? null)
    );
  });

  app.get("/api/cookbook/search", async (c) => {
    const query = c.req.query("q")?.trim() ?? "";
    return authenticatedJson(c, ({ token, countryCode }) =>
      searchCookbookService(token, countryCode, query)
    );
  });

  app.get("/api/recipe/resolve", async (c) => {
    const reference = c.req.query("ref")?.trim() ?? "";
    return authenticatedJson(c, ({ countryCode }) =>
      resolveRecipeReferenceService(countryCode, reference)
    );
  });

  app.get("/api/link/resolve", async (c) => {
    const reference = c.req.query("ref")?.trim() ?? "";
    return authenticatedJson(c, ({ countryCode }) =>
      resolvePicnicLinkService(countryCode, reference)
    );
  });

  app.post("/api/recipe/:id/saved", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      updateSavedRecipeService(token, countryCode, c.req.param("id"), true)
    );
  });

  app.delete("/api/recipe/:id/saved", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      updateSavedRecipeService(token, countryCode, c.req.param("id"), false)
    );
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
    return authenticatedJson(c, ({ token, countryCode }) =>
      getRecipeDetailService(token, countryCode, c.req.param("id"), c.req.query("portions") ?? null)
    );
  });
}
