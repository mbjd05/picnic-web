import type { Hono } from "hono";

import { getCategoriesService } from "@/lib/api-services/categories";
import { getCategoryProductsService, getSubcategoriesService } from "@/lib/api-services/products";

import { authenticatedJson } from "../lib/authenticated-handler";

export function registerCategoryRoutes(app: Hono): void {
  app.get("/api/categories", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getCategoriesService(token, countryCode)
    );
  });

  app.get("/api/categories/:categoryId/subcategories", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getSubcategoriesService(token, countryCode, c.req.param("categoryId"))
    );
  });

  app.get("/api/categories/:categoryId/products", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getCategoryProductsService(token, countryCode, c.req.param("categoryId"))
    );
  });
}
