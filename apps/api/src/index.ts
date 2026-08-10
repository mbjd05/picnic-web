import { Hono } from "hono";

import { upstreamUnavailableResponse } from "./lib/http";
import { apiSecurity } from "./lib/security";
import { registerAccountRoutes } from "./routes/account-routes";
import { registerAuthRoutes } from "./routes/auth-routes";
import { registerCartRoutes } from "./routes/cart-routes";
import { registerCategoryRoutes } from "./routes/category-routes";
import { registerCheckoutRoutes } from "./routes/checkout-routes";
import { registerDeliveryRoutes } from "./routes/delivery-routes";
import { registerPaymentRoutes } from "./routes/payment-routes";
import { registerProductRoutes } from "./routes/product-routes";
import { registerRecipeRoutes } from "./routes/recipe-routes";

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

registerAuthRoutes(app);
registerAccountRoutes(app);
registerPaymentRoutes(app);
registerCategoryRoutes(app);
registerProductRoutes(app);
registerCartRoutes(app);
registerDeliveryRoutes(app);
registerCheckoutRoutes(app);
registerRecipeRoutes(app);

export default app;
