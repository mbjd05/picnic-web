import { NextRequest, NextResponse } from "next/server";

import { fetchImageService } from "@/lib/api-services/images";
import { readAuthToken, readCountryCode } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.searchParams.get("url");
  const token = readAuthToken(request);
  const countryCode = readCountryCode(request);
  const result = await fetchImageService(url, token, countryCode);

  if (result.ok) {
    return new NextResponse(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": result.cacheControl,
      },
    });
  }

  return new NextResponse(result.body, { status: result.status });
}
