import type {
  AccountConsentUpdateResponse,
  AccountProfileResponse,
  ConsentSetting,
} from "@/types/account";

function matchesConsentSetting(candidate: ConsentSetting, target: ConsentSetting): boolean {
  if (target.text_id) return candidate.text_id === target.text_id;
  return Boolean(target.id && candidate.id === target.id);
}

function replaceConsentSetting(
  current: ConsentSetting[],
  replacements: ConsentSetting[],
  target: ConsentSetting
): ConsentSetting[] {
  const replacement = replacements.find((setting) => matchesConsentSetting(setting, target));
  if (!replacement) return current;

  return current.map((setting) => (matchesConsentSetting(setting, target) ? replacement : setting));
}

export function setOptimisticConsentDecision(
  profile: AccountProfileResponse,
  target: ConsentSetting,
  establishedDecision: boolean
): AccountProfileResponse {
  const update = (settings: ConsentSetting[]) =>
    settings.map((setting) =>
      matchesConsentSetting(setting, target)
        ? { ...setting, established_decision: establishedDecision }
        : setting
    );

  return {
    ...profile,
    consentSettings: update(profile.consentSettings),
    generalConsentSettings: update(profile.generalConsentSettings),
  };
}

export function applyConsentUpdate(
  profile: AccountProfileResponse,
  target: ConsentSetting,
  update: AccountConsentUpdateResponse
): AccountProfileResponse {
  return {
    ...profile,
    consentSettings: replaceConsentSetting(profile.consentSettings, update.consentSettings, target),
    generalConsentSettings: replaceConsentSetting(
      profile.generalConsentSettings,
      update.generalConsentSettings,
      target
    ),
  };
}
