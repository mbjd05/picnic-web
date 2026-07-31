import type { CountryCode } from "@/lib/types";

export type ImageServiceResult =
  | {
      ok: false;
      body: string;
      status: 400 | 403;
    }
  | {
      ok: false;
      body: null;
      status: number;
    }
  | {
      ok: true;
      body: ArrayBuffer;
      status: 200;
      contentType: string;
      cacheControl: string;
    };

const ALLOWED_HOST_SUFFIX = ".picnicinternational.com";

export async function fetchImageService(
  imageUrl: string | null,
  authToken: string | null,
  countryCode: CountryCode
): Promise<ImageServiceResult> {
  if (!imageUrl) {
    return { ok: false, body: "Missing url parameter", status: 400 };
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return { ok: false, body: "Invalid url", status: 400 };
  }

  if (!parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return { ok: false, body: "URL not allowed", status: 403 };
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "okhttp/4.9.0",
        "Accept-Language": countryCode === "DE" ? "de" : countryCode === "FR" ? "fr" : "nl",
        "x-picnic-agent": "30100;1.228.1-15480;",
        "x-picnic-did": "3C417201548B2E3B",
        ...(authToken && { "x-picnic-auth": authToken }),
      },
    });

    if (!response.ok) {
      return { ok: false, body: null, status: response.status };
    }

    return {
      ok: true,
      body: await response.arrayBuffer(),
      status: 200,
      contentType: response.headers.get("content-type") ?? "image/png",
      cacheControl: "public, max-age=86400, stale-while-revalidate=604800",
    };
  } catch {
    return { ok: false, body: null, status: 502 };
  }
}
