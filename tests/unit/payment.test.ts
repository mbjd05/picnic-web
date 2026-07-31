import { describe, expect, it } from "vitest";

import {
  getAvailablePaymentMethod,
  getErrorMessage,
  getPaymentDisplayName,
  getPaymentMethodDetails,
  getPreferredPaymentOption,
  getPreferredPaymentOptionForMethod,
  isEmptyJsonResponseError,
} from "@/lib/payment";
import type { PaymentProfile } from "@/lib/types";

const profile: PaymentProfile = {
  available_payment_methods: [
    { payment_method: "IDEAL", available_banks: [{ bank_id: "INGBNL2A", name: "ING" }] },
  ],
  payment_methods: [
    { payment_method: "IDEAL", display_name: "iDEAL" },
    { payment_method: "CARD", display_name: "Card" },
  ],
  preferred_payment_option_id: "stored-ideal",
  stored_payment_options: [
    {
      id: "stored-ideal",
      payment_method: "IDEAL",
      display_name: "ING",
    },
    {
      id: "stored-card",
      payment_method: "CARD",
      display_name: "Visa",
    },
  ],
};

describe("payment helpers", () => {
  it("finds preferred payment options and filters them by method", () => {
    expect(getPreferredPaymentOption(profile)?.id).toBe("stored-ideal");
    expect(getPreferredPaymentOptionForMethod(profile, "IDEAL")?.id).toBe("stored-ideal");
    expect(getPreferredPaymentOptionForMethod(profile, "CARD")).toBeNull();
  });

  it("returns null when a preferred payment option is missing or not configured", () => {
    expect(
      getPreferredPaymentOption({
        ...profile,
        preferred_payment_option_id: "missing",
      })
    ).toBeNull();
    expect(
      getPreferredPaymentOption({
        ...profile,
        preferred_payment_option_id: null,
      })
    ).toBeNull();
  });

  it("looks up available methods and method details", () => {
    expect(getAvailablePaymentMethod(profile, "IDEAL")?.available_banks?.[0]?.name).toBe("ING");
    expect(getAvailablePaymentMethod(profile, "WERO")).toBeNull();
    expect(getPaymentMethodDetails(profile, "CARD")?.display_name).toBe("Card");
    expect(getPaymentMethodDetails(profile, "WERO")).toBeNull();
  });

  it("uses the product display name required for the supported iDEAL and Wero flow", () => {
    expect(getPaymentDisplayName(profile, "IDEAL")).toBe("iDEAL | Wero");
    expect(getPaymentDisplayName(profile, "CARD")).toBe("Card");
    expect(getPaymentDisplayName(profile, "UNKNOWN")).toBe("UNKNOWN");
  });

  it("normalizes error messages used by API wrappers", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage("plain")).toBe("plain");
    expect(getErrorMessage({ code: "NOPE" })).toBe('{"code":"NOPE"}');
    expect(isEmptyJsonResponseError(new Error("Unexpected end of JSON input"))).toBe(true);
    expect(isEmptyJsonResponseError(new Error("other"))).toBe(false);
  });
});
