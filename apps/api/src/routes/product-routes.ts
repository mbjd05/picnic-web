import type { Hono } from "hono";

import { fetchImageService } from "@/lib/api-services/images";
import {
  getArbitraryProductsPageService,
  getProductDetailService,
  getSuggestionsService,
} from "@/lib/api-services/products";
import { searchProductsService } from "@/lib/api-services/search";

import { authenticatedJson } from "../lib/authenticated-handler";
import { jsonStatus } from "../lib/http";
import { readSession } from "../lib/session";

export function registerProductRoutes(app: Hono): void {
  app.get("/api/search", async (c) => {
    const query = c.req.query("q")?.trim() ?? "";
    return authenticatedJson(c, ({ token, countryCode }) =>
      searchProductsService(token, countryCode, query)
    );
  });

  app.get("/api/suggestions", async (c) => {
    const query = c.req.query("q")?.trim() ?? "";
    return authenticatedJson(c, ({ token, countryCode }) =>
      getSuggestionsService(token, countryCode, query)
    );
  });

  app.get("/api/product/:id", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getProductDetailService(token, countryCode, c.req.param("id"))
    );
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

    return authenticatedJson(c, ({ token, countryCode }) =>
      getArbitraryProductsPageService(token, countryCode, pageId)
    );
  });
}
