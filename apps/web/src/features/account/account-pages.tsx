import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type {
  AccountAddress,
  AccountConsentUpdateResponse,
  AccountHouseholdUpdateResponse,
  AccountProfileResponse,
  ConsentSetting,
  HouseholdDetails,
} from "@/types/account";

import { ErrorView, LoadingView } from "../../components/page-state";
import { useAccountProfile } from "../../hooks/use-account-profile";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { ApiClientError, fetchJson } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-config";
import { useCountryCode, useLanguageCode, useTranslations } from "../../providers/country-context";
import { getConsentDisplayText } from "./consent-display";

type DetailRowProps = {
  label: string;
  value: string | number | null | undefined;
};

export function AccountProfilePage() {
  const t = useTranslations();
  const profileQuery = useAccountProfile();
  const profile = profileQuery.data ?? null;
  const profileErrorMessage =
    profileQuery.error instanceof ApiClientError ? profileQuery.error.message : t.accountLoadError;

  useDocumentTitle(t.accountPageTitle);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">{t.accountPageTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.accountPageSubtitle}</p>
        </div>
      </div>

      {profileQuery.isPending ? <LoadingView /> : null}
      {profileQuery.isError ? (
        <ErrorView message={profileErrorMessage} onRetry={() => void profileQuery.refetch()} />
      ) : null}
      {profile ? <AccountProfileContent profile={profile} /> : null}
    </main>
  );
}

function AccountProfileContent({ profile }: { profile: AccountProfileResponse }) {
  const t = useTranslations();
  const countryCode = useCountryCode();
  const queryClient = useQueryClient();
  const user = profile.user;
  const displayName =
    profile.profileMenu.user?.name ??
    [user.firstname, user.lastname].filter(Boolean).join(" ") ??
    null;
  const address = user.address ?? profile.profileMenu.user?.address ?? null;
  const activeSubscriptions = countSubscribed(user.subscriptions);
  const activePushSubscriptions = countSubscribed(user.push_subscriptions);
  const editableConsentSettings = mergeConsentSettings(
    profile.generalConsentSettings,
    profile.consentSettings
  );
  const householdMutation = useMutation({
    mutationFn: (
      household: Required<Pick<HouseholdDetails, "adults" | "children" | "cats" | "dogs">>
    ) =>
      fetchJson<AccountHouseholdUpdateResponse>("/api/account/household", {
        method: "PUT",
        body: JSON.stringify(household),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<AccountProfileResponse>(
        queryKeys.accountProfile(countryCode),
        (current) => (current ? { ...current, user: data.user } : current)
      );
    },
  });
  const consentMutation = useMutation({
    mutationFn: (setting: ConsentSetting) =>
      fetchJson<AccountConsentUpdateResponse>("/api/account/consents", {
        method: "PUT",
        body: JSON.stringify({
          consent_declarations: [
            {
              consent_request_text_id: setting.text_id,
              consent_request_locale: setting.text_locale,
              agreement: !(setting.established_decision === true),
            },
          ],
        }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<AccountProfileResponse>(
        queryKeys.accountProfile(countryCode),
        (current) =>
          current
            ? {
                ...current,
                consentSettings: data.consentSettings,
                generalConsentSettings: data.generalConsentSettings,
              }
            : current
      );
    },
  });

  return (
    <div className="space-y-5">
      <section className="border-card-border bg-card-bg rounded-xl border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={displayName} imageUrl={profile.profileMenu.user?.avatar?.image_url} />
          <div className="min-w-0 flex-1">
            <h2 className="text-foreground text-lg font-semibold">
              {displayName || t.accountUnknownValue}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {formatAddress(address, t.accountUnknownValue)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-52">
            <Metric label={t.accountDeliveriesLabel} value={user.total_deliveries} />
            <Metric label={t.accountCompletedDeliveriesLabel} value={user.completed_deliveries} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <InfoSection title={t.accountDetailsTitle}>
            <DetailList>
              <DetailRow label={t.accountNameLabel} value={displayName} />
              <DetailRow label={t.accountCustomerTypeLabel} value={user.customer_type} />
            </DetailList>
          </InfoSection>

          <InfoSection title={t.accountAddressTitle}>
            <DetailList>
              <DetailRow label={t.accountAddressTitle} value={formatAddress(address, null)} />
            </DetailList>
          </InfoSection>

          <InfoSection title={t.accountLinksTitle} className="lg:flex-1">
            <Link
              to="/account/payment"
              search={{ from: undefined }}
              className="text-picnic-red inline-flex text-sm font-semibold hover:underline"
            >
              {t.accountPaymentLink}
            </Link>
          </InfoSection>
        </div>

        <div className="flex flex-col gap-5">
          <InfoSection title={t.accountContactTitle}>
            <DetailList>
              <DetailRow label={t.accountEmailLabel} value={user.contact_email} />
              <DetailRow
                label={t.accountPhoneLabel}
                value={profile.userInfo.redacted_phone_number ?? user.phone}
              />
            </DetailList>
          </InfoSection>

          <InfoSection title={t.accountHouseholdTitle}>
            <HouseholdEditor
              household={user.household_details ?? null}
              isSaving={householdMutation.isPending}
              error={householdMutation.isError ? t.accountHouseholdSaveError : null}
              onSave={(household) => householdMutation.mutate(household)}
            />
          </InfoSection>
        </div>
      </div>

      <InfoSection title={t.accountPreferencesTitle}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PreferenceSummary
            label={t.accountSubscriptionsLabel}
            value={t.accountSubscribedCount.replace("{count}", String(activeSubscriptions))}
          />
          <PreferenceSummary
            label={t.accountPushSubscriptionsLabel}
            value={t.accountSubscribedCount.replace("{count}", String(activePushSubscriptions))}
          />
          <PreferenceSummary
            label={t.accountConsentSettingsLabel}
            value={t.accountConfiguredCount.replace(
              "{count}",
              String(editableConsentSettings.length)
            )}
          />
          <PreferenceSummary
            label={t.accountGeneralConsentSettingsLabel}
            value={t.accountConfiguredCount.replace(
              "{count}",
              String(profile.generalConsentSettings.length)
            )}
          />
        </div>
        <ConsentSettingsList
          settings={editableConsentSettings}
          pendingTextId={
            consentMutation.isPending ? (consentMutation.variables?.text_id ?? null) : null
          }
          error={consentMutation.isError ? t.accountConsentSaveError : null}
          onToggle={(setting) => consentMutation.mutate(setting)}
        />
      </InfoSection>
    </div>
  );
}

function InfoSection({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`border-card-border bg-card-bg rounded-xl border p-4 ${className}`}>
      <h2 className="text-foreground text-base font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailList({
  className = "space-y-3",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <dl className={className}>{children}</dl>;
}

function DetailRow({ label, value }: DetailRowProps) {
  const t = useTranslations();
  const displayValue =
    value === null || value === undefined || value === "" ? t.accountUnknownValue : String(value);

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="text-foreground text-sm font-medium break-words sm:text-right">
        {displayValue}
      </dd>
    </div>
  );
}

function PreferenceSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-card-border bg-muted-bg rounded-lg border px-3 py-2">
      <div className="text-muted text-xs">{label}</div>
      <div className="text-foreground mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function HouseholdEditor({
  household,
  isSaving,
  error,
  onSave,
}: {
  household: HouseholdDetails | null;
  isSaving: boolean;
  error: string | null;
  onSave: (
    household: Required<Pick<HouseholdDetails, "adults" | "children" | "cats" | "dogs">>
  ) => void;
}) {
  const t = useTranslations();
  const [values, setValues] = useState(() => householdValues(household));
  const currentValues = useMemo(() => householdValues(household), [household]);
  const isChanged =
    values.adults !== currentValues.adults ||
    values.children !== currentValues.children ||
    values.cats !== currentValues.cats ||
    values.dogs !== currentValues.dogs;

  useEffect(() => {
    setValues(currentValues);
  }, [currentValues]);

  function updateValue(key: keyof typeof values, value: string) {
    const parsed = Number.parseInt(value, 10);
    setValues((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 20)) : 0,
    }));
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (isChanged && !isSaving) onSave(values);
      }}
    >
      <p className="text-muted text-sm">{t.accountEditableHouseholdNote}</p>
      <div className="grid grid-cols-2 gap-3">
        <HouseholdInput
          label={t.accountHouseholdAdults}
          value={values.adults}
          onChange={(value) => updateValue("adults", value)}
        />
        <HouseholdInput
          label={t.accountHouseholdChildren}
          value={values.children}
          onChange={(value) => updateValue("children", value)}
        />
        <HouseholdInput
          label={t.accountHouseholdCats}
          value={values.cats}
          onChange={(value) => updateValue("cats", value)}
        />
        <HouseholdInput
          label={t.accountHouseholdDogs}
          value={values.dogs}
          onChange={(value) => updateValue("dogs", value)}
        />
      </div>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={!isChanged || isSaving}
        className="bg-picnic-red rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isSaving ? t.accountSavingChanges : t.accountSaveChanges}
      </button>
    </form>
  );
}

function HouseholdInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-muted block text-sm font-medium">
      {label}
      <input
        type="number"
        min={0}
        max={20}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input-border bg-card-bg text-foreground mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
      />
    </label>
  );
}

function ConsentSettingsList({
  settings,
  pendingTextId,
  error,
  onToggle,
}: {
  settings: ConsentSetting[];
  pendingTextId: string | null;
  error: string | null;
  onToggle: (setting: ConsentSetting) => void;
}) {
  const t = useTranslations();
  const languageCode = useLanguageCode();
  const editableSettings = settings.filter(
    (setting) =>
      typeof setting.text_id === "string" &&
      typeof setting.text_locale === "string" &&
      typeof setting.established_decision === "boolean"
  );

  if (editableSettings.length === 0) return null;

  return (
    <div className="border-card-border mt-4 space-y-3 border-t pt-4">
      <p className="text-muted text-sm">{t.accountEditableConsentsNote}</p>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <div className="grid gap-2 lg:grid-cols-2">
        {editableSettings.map((setting) => {
          const checked = setting.established_decision === true;
          const isPending = pendingTextId === setting.text_id;
          const displayText = getConsentDisplayText(setting, languageCode);
          return (
            <button
              key={setting.text_id}
              type="button"
              role="switch"
              aria-checked={checked}
              disabled={isPending}
              onClick={() => onToggle(setting)}
              className="border-card-border bg-card-bg hover:border-picnic-red flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-wait disabled:opacity-70"
            >
              <span className="min-w-0">
                <span className="text-foreground block text-sm font-medium">
                  {displayText.title || t.accountConsentSettingsLabel}
                </span>
                {displayText.text ? (
                  <span className="text-muted mt-0.5 line-clamp-2 block text-xs">
                    {displayText.text}
                  </span>
                ) : null}
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  checked ? "bg-picnic-red" : "bg-gray-300"
                }`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    checked ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="border-card-border rounded-lg border px-3 py-2 text-center">
      <div className="text-foreground text-lg font-bold tabular-nums">{value ?? 0}</div>
      <div className="text-muted text-xs">{label}</div>
    </div>
  );
}

function Avatar({ name, imageUrl }: { name: string | null; imageUrl?: string | null }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="border-card-border h-16 w-16 rounded-full border object-cover"
      />
    );
  }

  return (
    <div
      className="bg-picnic-red flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
      aria-hidden="true"
    >
      {initials || "P"}
    </div>
  );
}

function countSubscribed(subscriptions: AccountProfileResponse["user"]["subscriptions"]): number {
  return subscriptions?.filter((subscription) => subscription.subscribed).length ?? 0;
}

function householdValues(household: HouseholdDetails | null) {
  return {
    adults: household?.adults ?? 0,
    children: household?.children ?? 0,
    cats: household?.cats ?? 0,
    dogs: household?.dogs ?? 0,
  };
}

function mergeConsentSettings(...settingGroups: ConsentSetting[][]): ConsentSetting[] {
  const settings = new Map<string, ConsentSetting>();

  for (const setting of settingGroups.flat()) {
    const key = setting.text_id ?? setting.id;
    if (key && !settings.has(key)) settings.set(key, setting);
  }

  return [...settings.values()];
}

function formatAddress(address: AccountAddress | null, fallback: string | null): string | null {
  if (!address) return fallback;
  const houseNumber = [address.house_number, address.house_number_ext].filter(Boolean).join("");
  const street = [address.street, houseNumber].filter(Boolean).join(" ");
  const city = [address.postcode, address.city].filter(Boolean).join(" ");
  const formatted = [street, city].filter(Boolean).join(", ");
  return formatted || fallback;
}
