import { describe, expect, it } from "vitest";

import {
  applyConsentUpdate,
  setOptimisticConsentDecision,
} from "../../apps/web/src/features/account/account-profile-cache";
import type {
  AccountConsentUpdateResponse,
  AccountProfileResponse,
  ConsentSetting,
} from "../../src/types/account";

const target: ConsentSetting = {
  id: "setting-id",
  text_id: "target-text-id",
  text_locale: "nl_NL",
  established_decision: true,
};

function profile(): AccountProfileResponse {
  return {
    user: {},
    userInfo: {},
    profileMenu: {},
    currentAvatar: null,
    consentSettings: [target, { text_id: "other", established_decision: true }],
    generalConsentSettings: [{ ...target }],
  };
}

describe("account profile consent cache", () => {
  it("updates matching consent entries immediately without changing other settings", () => {
    const updated = setOptimisticConsentDecision(profile(), target, false);

    expect(updated.consentSettings[0]?.established_decision).toBe(false);
    expect(updated.generalConsentSettings[0]?.established_decision).toBe(false);
    expect(updated.consentSettings[1]?.established_decision).toBe(true);
  });

  it("reconciles only the mutated setting from the server response", () => {
    const current = setOptimisticConsentDecision(profile(), target, false);
    current.consentSettings[1] = { text_id: "other", established_decision: false };
    const response: AccountConsentUpdateResponse = {
      user: {},
      result: null,
      consentSettings: [{ ...target, established_decision: true }],
      generalConsentSettings: [{ ...target, established_decision: true }],
    };

    const updated = applyConsentUpdate(current, target, response);

    expect(updated.consentSettings[0]?.established_decision).toBe(true);
    expect(updated.generalConsentSettings[0]?.established_decision).toBe(true);
    expect(updated.consentSettings[1]?.established_decision).toBe(false);
  });
});
