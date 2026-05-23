import type { ApiErrorResponse } from "@/lib/types";

export async function readJsonResponse<T>(
  response: Response,
  fallbackError: string
): Promise<T | ApiErrorResponse> {
  let data: unknown;

  try {
    data = await response.json();
  } catch {
    return { error: fallbackError };
  }

  if (!response.ok) {
    if (isApiErrorResponse(data)) {
      return data;
    }
    return { error: fallbackError };
  }

  return data as T;
}

export function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  );
}
