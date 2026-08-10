import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { AccountAddress, AccountProfileResponse, HouseholdDetails } from "@/types/account";

import { ErrorView, LoadingView } from "../../components/page-state";
import { useAccountProfile } from "../../hooks/use-account-profile";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { ApiClientError } from "../../lib/api-client";
import { useTranslations } from "../../providers/country-context";

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
  const user = profile.user;
  const displayName =
    profile.profileMenu.user?.name ??
    [user.firstname, user.lastname].filter(Boolean).join(" ") ??
    null;
  const address = user.address ?? profile.profileMenu.user?.address ?? null;
  const activeSubscriptions = countSubscribed(user.subscriptions);
  const activePushSubscriptions = countSubscribed(user.push_subscriptions);

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

      <p className="border-card-border bg-muted-bg rounded-xl border px-4 py-3 text-sm text-gray-600">
        {t.accountReadOnlyNote}
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <InfoSection title={t.accountDetailsTitle}>
          <DetailRow label={t.accountNameLabel} value={displayName} />
          <DetailRow label={t.accountCustomerTypeLabel} value={user.customer_type} />
        </InfoSection>

        <InfoSection title={t.accountContactTitle}>
          <DetailRow label={t.accountEmailLabel} value={user.contact_email} />
          <DetailRow
            label={t.accountPhoneLabel}
            value={profile.userInfo.redacted_phone_number ?? user.phone}
          />
        </InfoSection>

        <InfoSection title={t.accountAddressTitle}>
          <DetailRow label={t.accountAddressTitle} value={formatAddress(address, null)} />
        </InfoSection>

        <InfoSection title={t.accountHouseholdTitle}>
          <HouseholdRows household={user.household_details ?? null} />
        </InfoSection>

        <InfoSection title={t.accountPreferencesTitle}>
          <DetailRow
            label={t.accountSubscriptionsLabel}
            value={t.accountSubscribedCount.replace("{count}", String(activeSubscriptions))}
          />
          <DetailRow
            label={t.accountPushSubscriptionsLabel}
            value={t.accountSubscribedCount.replace("{count}", String(activePushSubscriptions))}
          />
          <DetailRow
            label={t.accountConsentSettingsLabel}
            value={t.accountConfiguredCount.replace(
              "{count}",
              String(profile.consentSettings.length)
            )}
          />
          <DetailRow
            label={t.accountGeneralConsentSettingsLabel}
            value={t.accountConfiguredCount.replace(
              "{count}",
              String(profile.generalConsentSettings.length)
            )}
          />
        </InfoSection>

        <InfoSection title={t.accountLinksTitle}>
          <Link
            to="/account/payment"
            search={{ from: undefined }}
            className="text-picnic-red inline-flex text-sm font-semibold hover:underline"
          >
            {t.accountPaymentLink}
          </Link>
        </InfoSection>
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-card-border bg-card-bg rounded-xl border p-4">
      <h2 className="text-foreground text-base font-semibold">{title}</h2>
      <dl className="mt-3 space-y-3">{children}</dl>
    </section>
  );
}

function DetailRow({ label, value }: DetailRowProps) {
  const t = useTranslations();
  const displayValue =
    value === null || value === undefined || value === "" ? t.accountUnknownValue : String(value);

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-foreground text-sm font-medium break-words sm:text-right">
        {displayValue}
      </dd>
    </div>
  );
}

function HouseholdRows({ household }: { household: HouseholdDetails | null }) {
  const t = useTranslations();

  return (
    <>
      <DetailRow label={t.accountHouseholdAdults} value={household?.adults} />
      <DetailRow label={t.accountHouseholdChildren} value={household?.children} />
      <DetailRow label={t.accountHouseholdCats} value={household?.cats} />
      <DetailRow label={t.accountHouseholdDogs} value={household?.dogs} />
    </>
  );
}

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="border-card-border rounded-lg border px-3 py-2 text-center">
      <div className="text-foreground text-lg font-bold tabular-nums">{value ?? 0}</div>
      <div className="text-xs text-gray-500">{label}</div>
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

function formatAddress(address: AccountAddress | null, fallback: string | null): string | null {
  if (!address) return fallback;
  const houseNumber = [address.house_number, address.house_number_ext].filter(Boolean).join("");
  const street = [address.street, houseNumber].filter(Boolean).join(" ");
  const city = [address.postcode, address.city].filter(Boolean).join(" ");
  const formatted = [street, city].filter(Boolean).join(", ");
  return formatted || fallback;
}
