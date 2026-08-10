import type { Hono } from "hono";

import { getAccountProfileService } from "@/lib/api-services/account";

import { authenticatedJson } from "../lib/authenticated-handler";

export function registerAccountRoutes(app: Hono): void {
  app.get("/api/account/profile", async (c) => {
    return authenticatedJson(c, ({ token, countryCode }) =>
      getAccountProfileService(token, countryCode)
    );
  });
}
