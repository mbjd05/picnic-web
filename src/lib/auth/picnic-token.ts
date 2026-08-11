const MAX_JWT_PAYLOAD_SEGMENT_LENGTH = 8192;
const PICNIC_DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Read the device identifier Picnic embeds in an authenticated JWT.
 *
 * This does not authenticate the token. The value is used only as a matching
 * upstream request header; Picnic still verifies the token itself.
 */
export function parsePicnicDeviceId(authToken: string): string | null {
  const payloadSegment = authToken.split(".")[1];
  if (
    !payloadSegment ||
    payloadSegment.length > MAX_JWT_PAYLOAD_SEGMENT_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(payloadSegment)
  ) {
    return null;
  }

  try {
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(`${normalized}${padding}`);
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

    const deviceId = (payload as Record<string, unknown>)["pc:did"];
    return typeof deviceId === "string" && PICNIC_DEVICE_ID_PATTERN.test(deviceId)
      ? deviceId
      : null;
  } catch {
    return null;
  }
}
