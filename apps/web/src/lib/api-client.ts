import ky, { type Options } from "ky";

import type { ApiErrorResponse } from "@/lib/types";

type ErrorPayload = Partial<ApiErrorResponse> & Record<string, unknown>;

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

let isRedirectingToLogin = false;

function redirectExpiredSession(): void {
  if (typeof window === "undefined" || isRedirectingToLogin) return;
  if (window.location.pathname === "/login") return;

  isRedirectingToLogin = true;
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const search = new URLSearchParams({ expired: "true", redirect });
  window.location.assign(`/login?${search.toString()}`);
}

function isErrorPayload(value: unknown): value is ErrorPayload {
  return typeof value === "object" && value !== null;
}

export async function fetchJson<T>(input: string | URL, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await ky(input, {
    ...(init as Options),
    credentials: "same-origin",
    headers,
    throwHttpErrors: false,
  });

  const text = await response.text();
  let payload: unknown;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiClientError("The server returned an invalid response.", response.status);
    }
  }

  const errorPayload = isErrorPayload(payload) ? payload : undefined;
  const code = typeof errorPayload?.code === "string" ? errorPayload.code : undefined;

  if (response.status === 401 && code === "TOKEN_EXPIRED") {
    redirectExpiredSession();
  }

  if (!response.ok) {
    const message =
      typeof errorPayload?.error === "string"
        ? errorPayload.error
        : `Request failed with status ${response.status}.`;
    throw new ApiClientError(message, response.status, code, payload);
  }

  return payload as T;
}
