import { describe, expect, it } from "vitest";

import {
  authCookieNameForCountry,
  parseAuthToken,
  parseCountryCookie,
} from "@/lib/session-cookies";

describe("session cookies", () => {
  it("uses separate auth cookie names per Picnic region", () => {
    expect(authCookieNameForCountry("NL")).toBe("picnic_auth_token_nl");
    expect(authCookieNameForCountry("DE")).toBe("picnic_auth_token_de");
    expect(authCookieNameForCountry("FR")).toBe("picnic_auth_token_fr");
  });

  it("parses country and auth cookie values defensively", () => {
    expect(parseCountryCookie("de")).toBe("DE");
    expect(parseCountryCookie("unknown")).toBe("NL");
    expect(parseAuthToken(" token ")).toBe(" token ");
    expect(parseAuthToken("")).toBeNull();
  });
});
