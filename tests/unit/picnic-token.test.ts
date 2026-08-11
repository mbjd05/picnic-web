import { describe, expect, it } from "vitest";

import { parsePicnicDeviceId } from "@/lib/auth/picnic-token";
import { buildPicnicClient } from "@/lib/picnic/client";

function tokenWithPayload(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${encoded}.signature`;
}

describe("Picnic token claims", () => {
  it("reads the device identifier from a Picnic JWT payload", () => {
    const token = tokenWithPayload({ "pc:did": "16AAA39A3A57375D" });
    expect(parsePicnicDeviceId(token)).toBe("16AAA39A3A57375D");
    expect(buildPicnicClient(token, "NL").deviceId).toBe("16AAA39A3A57375D");
  });

  it("rejects tokens without a usable device identifier", () => {
    expect(parsePicnicDeviceId(tokenWithPayload({ sub: "user" }))).toBeNull();
    expect(parsePicnicDeviceId(tokenWithPayload({ "pc:did": "contains spaces" }))).toBeNull();
    expect(parsePicnicDeviceId("not-a-jwt")).toBeNull();
    expect(parsePicnicDeviceId("header.%%%.signature")).toBeNull();
  });
});
