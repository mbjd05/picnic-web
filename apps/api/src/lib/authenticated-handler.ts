import type { Context } from "hono";

import type { CountryCode } from "@/lib/types";

import { authRequiredResponse, jsonStatus } from "./http";
import { readSession } from "./session";

type AuthenticatedSession = {
  token: string;
  countryCode: CountryCode;
};

type ServiceResult<TBody> = {
  body: TBody;
  status?: number;
};

export async function authenticatedJson<TBody>(
  c: Context,
  handler: (session: AuthenticatedSession) => Promise<ServiceResult<TBody>>
) {
  const { token, countryCode } = readSession(c);
  if (!token) {
    return authRequiredResponse(c);
  }

  const result = await handler({ token, countryCode });
  return c.json(result.body, jsonStatus(result.status));
}
