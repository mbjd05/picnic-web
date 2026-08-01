import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AuthApiResponse } from "@/lib/auth-types";

export function jsonStatus(status: number | undefined): ContentfulStatusCode {
  return (status ?? 200) as ContentfulStatusCode;
}

export function setNoStore(c: Context): void {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
}

export function authRequiredResponse(c: Context) {
  return c.json({ error: "Authentication required", code: "TOKEN_EXPIRED" as const }, 401);
}

export function authJson(c: Context, body: AuthApiResponse, status?: number) {
  setNoStore(c);
  return c.json(body, jsonStatus(status));
}

export function upstreamUnavailableResponse(c: Context) {
  return c.json({ error: "Upstream service unavailable" }, 502);
}
