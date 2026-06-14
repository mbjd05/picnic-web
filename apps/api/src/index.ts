import { type Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { getCategoriesService } from "@/lib/api-services/categories";
import { getCookbookService, searchCookbookService } from "@/lib/api-services/cookbook";
import { searchProductsService } from "@/lib/api-services/search";
import {
  AUTH_COOKIE_NAME,
  COUNTRY_COOKIE_NAME,
  parseAuthToken,
  parseCountryCookie,
} from "@/lib/session-cookies";

const app = new Hono();

function readSession(c: Context) {
  const token = parseAuthToken(getCookie(c, AUTH_COOKIE_NAME));
  const countryCode = parseCountryCookie(getCookie(c, COUNTRY_COOKIE_NAME));
  return { token, countryCode };
}

function jsonStatus(status: number | undefined): ContentfulStatusCode {
  return (status ?? 200) as ContentfulStatusCode;
}

function authRequiredResponse(c: Context) {
  return c.json({ error: "Authentication required", code: "TOKEN_EXPIRED" as const }, 401);
}

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "picnic-web-api",
  })
);

app.get("/api/categories", async (c) => {
  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const result = await getCategoriesService(token, countryCode);
  return c.json(result.body, jsonStatus(result.status));
});

app.get("/api/search", async (c) => {
  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const query = c.req.query("q")?.trim() ?? "";
  const result = await searchProductsService(token, countryCode, query);
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

export default app;
