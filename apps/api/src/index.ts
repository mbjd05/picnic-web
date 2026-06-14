import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "picnic-web-api",
  })
);

export default app;
