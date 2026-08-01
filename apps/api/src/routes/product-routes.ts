import type { Hono } from "hono";

import { fetchImageService } from "@/lib/api-services/images";
import {
  getArbitraryProductsPageService,
  getProductDetailService,
  getSuggestionsService,
} from "@/lib/api-services/products";
import { searchProductsService } from "@/lib/api-services/search";

import { authRequiredResponse, jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

export function registerProductRoutes(app: Hono): void {
  app.get("/api/search", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const query = c.req.query("q")?.trim() ?? "";
    const result = await searchProductsService(token, countryCode, query);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/suggestions", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const query = c.req.query("q")?.trim() ?? "";
    const result = await getSuggestionsService(token, countryCode, query);
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/product/:id", async (c) => {
    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getProductDetailService(token, countryCode, c.req.param("id"));
    return c.json(result.body, jsonStatus(result.status));
  });

  app.get("/api/image", async (c) => {
    const { token, countryCode } = readSession(c);
    const result = await fetchImageService(c.req.query("url") ?? null, token, countryCode);

    if (result.ok) {
      return c.body(result.body, 200, {
        "Content-Type": result.contentType,
        "Cache-Control": result.cacheControl,
      });
    }

    if (result.body === null) {
      return c.body(null, jsonStatus(result.status));
    }
    return c.body(result.body, jsonStatus(result.status));
  });

  app.get("/api/pages/products", async (c) => {
    const pageId = c.req.query("pageId") ?? null;
    if (!pageId) {
      return c.json({ error: "Missing pageId parameter" }, 400);
    }

    const { token, countryCode } = readSession(c);
    if (!token) {
      return authRequiredResponse(c);
    }

    const result = await getArbitraryProductsPageService(token, countryCode, pageId);
    return c.json(result.body, jsonStatus(result.status));
  });
}
