import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
  type AuthServiceResult,
  loginWithCredentialsService,
  loginWithTokenService,
  resolveAuthCountryCode,
  verify2FAService,
} from "@/lib/api-services/auth";
import {
  getCartService,
  getDeliverySlotsService,
  mutateCartService,
  setDeliverySlotService,
} from "@/lib/api-services/cart";
import { getCategoriesService } from "@/lib/api-services/categories";
import { getCookbookService, searchCookbookService } from "@/lib/api-services/cookbook";
import { fetchImageService } from "@/lib/api-services/images";
import {
  cancelCheckoutService,
  createPaymentOptionService,
  getCheckoutStatusService,
  getPaymentProfileService,
  removePaymentOptionService,
  startCheckoutPaymentService,
} from "@/lib/api-services/payments";
import {
  getArbitraryProductsPageService,
  getCategoryProductsService,
  getProductDetailService,
  getSubcategoriesService,
  getSuggestionsService,
} from "@/lib/api-services/products";
import {
  addRecipeToCartService,
  getCookbookCountsService,
  getRecipeDetailService,
  updateSavedRecipeService,
} from "@/lib/api-services/recipes";
import { searchProductsService } from "@/lib/api-services/search";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  COUNTRY_COOKIE_NAME,
  parseAuthToken,
  parseCountryCookie,
} from "@/lib/session-cookies";
import type { AuthApiResponse } from "@/lib/types";

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

function isCrossOriginUnsafeRequest(c: Context): boolean {
  const origin = c.req.header("origin");

  if (origin && origin !== new URL(c.req.url).origin) {
    return true;
  }

  if (!origin && c.req.header("sec-fetch-site") === "cross-site") {
    return true;
  }

  return false;
}

function setNoStore(c: Context) {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
}

function authJson(c: Context, body: AuthApiResponse, status?: number) {
  setNoStore(c);
  return c.json(body, jsonStatus(status));
}

function invalidOriginResponse(c: Context) {
  return authJson(c, { success: false, error: "Invalid request origin" }, 403);
}

function secureCookie(c: Context): boolean {
  return new URL(c.req.url).protocol === "https:";
}

function setAuthCookie(c: Context, authToken: string) {
  setCookie(c, AUTH_COOKIE_NAME, authToken, {
    httpOnly: true,
    secure: secureCookie(c),
    sameSite: "Strict",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

function clearAuthCookie(c: Context) {
  deleteCookie(c, AUTH_COOKIE_NAME, {
    secure: secureCookie(c),
    sameSite: "Strict",
    path: "/",
  });
}

function setCountryCookie(c: Context, countryCode: string) {
  setCookie(c, COUNTRY_COOKIE_NAME, countryCode, {
    httpOnly: false,
    secure: secureCookie(c),
    sameSite: "Lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

function applyAuthResultCookies(c: Context, result: AuthServiceResult) {
  if (result.authToken) {
    setAuthCookie(c, result.authToken);
  }
  if (result.countryCode) {
    setCountryCookie(c, result.countryCode);
  }
}

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "picnic-web-api",
  })
);

app.post("/api/auth/login", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return invalidOriginResponse(c);
  }

  const body = await c.req.json().catch(() => null);
  const { countryCode } = readSession(c);
  const result = await loginWithTokenService(
    typeof body?.token === "string" ? body.token : undefined,
    resolveAuthCountryCode(body?.countryCode, countryCode)
  );

  applyAuthResultCookies(c, result);
  return authJson(c, result.body, result.status);
});

app.post("/api/auth/login-credentials", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return invalidOriginResponse(c);
  }

  const body = await c.req.json().catch(() => null);
  const { countryCode } = readSession(c);
  const result = await loginWithCredentialsService(
    typeof body?.email === "string" ? body.email : undefined,
    typeof body?.password === "string" ? body.password : undefined,
    resolveAuthCountryCode(body?.countryCode, countryCode)
  );

  applyAuthResultCookies(c, result);
  return authJson(c, result.body, result.status);
});

app.post("/api/auth/verify-2fa", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return invalidOriginResponse(c);
  }

  const body = await c.req.json().catch(() => null);
  const { countryCode } = readSession(c);
  const result = await verify2FAService(
    typeof body?.partialToken === "string" ? body.partialToken : undefined,
    typeof body?.code === "string" ? body.code : undefined,
    countryCode
  );

  applyAuthResultCookies(c, result);
  return authJson(c, result.body, result.status);
});

app.post("/api/auth/logout", (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return invalidOriginResponse(c);
  }

  clearAuthCookie(c);
  return authJson(c, { success: true });
});

app.get("/api/account/payment-profile", async (c) => {
  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const result = await getPaymentProfileService(token, countryCode);
  return c.json(result.body, jsonStatus(result.status));
});

app.post("/api/account/payment-profile", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const body = await c.req.json().catch(() => null);
  if (body === null) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = await createPaymentOptionService(token, countryCode, body);
  return c.json(result.body, jsonStatus(result.status));
});

app.post("/api/account/payment-profile/payment-options", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const body = await c.req.json().catch(() => null);
  if (body === null) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = await createPaymentOptionService(token, countryCode, body);
  return c.json(result.body, jsonStatus(result.status));
});

app.delete("/api/account/payment-profile/payment-options/:paymentOptionId", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const result = await removePaymentOptionService(
    token,
    countryCode,
    c.req.param("paymentOptionId")
  );
  return c.json(result.body, jsonStatus(result.status));
});

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
    return new Response(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": result.cacheControl,
      },
    });
  }

  return new Response(result.body, { status: result.status });
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

app.get("/api/cart", async (c) => {
  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const result = await getCartService(token, countryCode);
  return c.json(result.body, jsonStatus(result.status));
});

app.post("/api/cart", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

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
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

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

app.post("/api/checkout/start-payment", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const appReturnUrl = new URL("/cart/payment-return", c.req.url).toString();
  const result = await startCheckoutPaymentService(token, countryCode, appReturnUrl);
  return c.json(result.body, jsonStatus(result.status));
});

app.post("/api/checkout/cancel", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const body = await c.req.json().catch(() => null);
  if (body === null) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = await cancelCheckoutService(token, countryCode, body);
  return c.json(result.body, jsonStatus(result.status));
});

app.get("/api/checkout/status/:transactionId", async (c) => {
  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const result = await getCheckoutStatusService(token, countryCode, c.req.param("transactionId"));
  return c.json(result.body, jsonStatus(result.status));
});

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
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const result = await updateSavedRecipeService(token, countryCode, c.req.param("id"), true);
  return c.json(result.body, jsonStatus(result.status));
});

app.delete("/api/recipe/:id/saved", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const result = await updateSavedRecipeService(token, countryCode, c.req.param("id"), false);
  return c.json(result.body, jsonStatus(result.status));
});

app.post("/api/recipe/:id/add-to-cart", async (c) => {
  if (isCrossOriginUnsafeRequest(c)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

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

export default app;
