import type { Context, Next } from "hono";

import { setNoStore } from "./http";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PUBLIC_API_PATHS = new Set(["/api/health", "/api/image"]);

function isCrossOriginUnsafeRequest(c: Context): boolean {
  if (SAFE_METHODS.has(c.req.method)) {
    return false;
  }

  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) {
    return true;
  }

  return !origin && c.req.header("sec-fetch-site") === "cross-site";
}

function setSecurityHeaders(c: Context): void {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (new URL(c.req.url).protocol === "https:") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

export async function apiSecurity(c: Context, next: Next) {
  setSecurityHeaders(c);

  const path = new URL(c.req.url).pathname;
  if (!PUBLIC_API_PATHS.has(path)) {
    setNoStore(c);
  }

  if (isCrossOriginUnsafeRequest(c)) {
    if (path.startsWith("/api/auth/")) {
      return c.json({ success: false as const, error: "Invalid request origin" }, 403);
    }
    return c.json({ error: "Invalid request origin" }, 403);
  }

  await next();
}
