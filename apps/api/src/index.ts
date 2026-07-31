import { Hono } from "hono";

import {
  loginWithCredentialsService,
  loginWithTokenService,
  resolveAuthCountryCode,
  resolveTwoFactorChannel,
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
import {
  cancelDeliveryService,
  getDeliveryDetailService,
  getDeliveryOrderStatusService,
  getDeliverySummariesService,
  getDeliveryTrackingService,
  sendDeliveryInvoiceEmailService,
  setDeliveryRatingService,
} from "@/lib/api-services/deliveries";
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
  authCredentialsLoginSchema,
  authTokenLoginSchema,
  deliveryRatingSchema,
  switchCountrySchema,
  twoFactorVerifySchema,
  validateInput,
} from "@/lib/api-validation";

import {
  authJson,
  authRequiredResponse,
  jsonStatus,
  upstreamUnavailableResponse,
} from "./lib/http";
import { apiSecurity } from "./lib/security";
import {
  applyAuthResultCookies,
  clearAuthCookie,
  readSession,
  switchSessionCountry,
} from "./lib/session";

const app = new Hono();

app.use("/api/*", apiSecurity);

app.onError((error, c) => {
  console.error("[worker] Unhandled API error", {
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    name: error.name,
  });
  return upstreamUnavailableResponse(c);
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "picnic-web-api",
  })
);

app.get("/api/dev/login-from-env", async (c) => {
  const url = new URL(c.req.url);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    return authJson(c, { success: false, error: "TOKEN_INVALID" }, 404);
  }

  const env = c.env as Record<string, string | undefined>;
  const token = env.PICNIC_TOKEN?.trim() || process.env.PICNIC_TOKEN?.trim();
  if (!token) {
    return c.text("Missing local PICNIC_TOKEN.", 500);
  }

  const { countryCode } = readSession(c);
  const result = await loginWithTokenService(
    token,
    resolveAuthCountryCode(env.PICNIC_COUNTRY_CODE, countryCode)
  );

  applyAuthResultCookies(c, result);
  if (result.body.success) return c.redirect("/");

  return c.text("Local PICNIC_TOKEN could not be used for login.", 401);
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const { countryCode } = readSession(c);
  const validation = validateInput(authTokenLoginSchema, body);
  const result = await loginWithTokenService(
    validation.ok ? validation.data.token : undefined,
    resolveAuthCountryCode(validation.ok ? validation.data.countryCode : undefined, countryCode),
    resolveTwoFactorChannel(validation.ok ? validation.data.twoFactorChannel : undefined)
  );

  applyAuthResultCookies(c, result);
  return authJson(c, result.body, result.status);
});

app.post("/api/auth/login-credentials", async (c) => {
  const body = await c.req.json().catch(() => null);
  const { countryCode } = readSession(c);
  const validation = validateInput(authCredentialsLoginSchema, body);
  const result = await loginWithCredentialsService(
    validation.ok ? validation.data.email : undefined,
    validation.ok ? validation.data.password : undefined,
    resolveAuthCountryCode(validation.ok ? validation.data.countryCode : undefined, countryCode),
    resolveTwoFactorChannel(validation.ok ? validation.data.twoFactorChannel : undefined)
  );

  applyAuthResultCookies(c, result);
  return authJson(c, result.body, result.status);
});

app.post("/api/auth/verify-2fa", async (c) => {
  const body = await c.req.json().catch(() => null);
  const { countryCode } = readSession(c);
  const validation = validateInput(twoFactorVerifySchema, body);
  const result = await verify2FAService(
    validation.ok ? validation.data.partialToken : undefined,
    validation.ok ? validation.data.code : undefined,
    countryCode
  );

  applyAuthResultCookies(c, result);
  return authJson(c, result.body, result.status);
});

app.post("/api/auth/logout", (c) => {
  clearAuthCookie(c);
  return authJson(c, { success: true });
});

app.post("/api/auth/switch-country", async (c) => {
  const body = await c.req.json().catch(() => null);
  const { countryCode } = readSession(c);
  const validation = validateInput(switchCountrySchema, body);
  const targetCountryCode = resolveAuthCountryCode(
    validation.ok ? validation.data.countryCode : undefined,
    countryCode
  );

  return c.json({
    success: true,
    countryCode: targetCountryCode,
    authenticated: switchSessionCountry(c, targetCountryCode),
  });
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

app.post("/api/checkout/start-payment", async (c) => {
  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const appReturnUrl = new URL("/cart/payment-return", c.req.url).toString();
  const result = await startCheckoutPaymentService(token, countryCode, appReturnUrl);
  return c.json(result.body, jsonStatus(result.status));
});

app.post("/api/checkout/cancel", async (c) => {
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

export default app;
