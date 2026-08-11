import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";

import type {
  AccountAddress,
  AccountAvatarUpdateResponse,
  AccountAvatarOptionsResponse,
  AccountConsentUpdateResponse,
  AccountHouseholdUpdateResponse,
  AccountNameUpdateResponse,
  AccountProfileResponse,
  AddressRetrieveResponse,
  AddressSpecificationRequest,
  AddressSpecificationResponse,
  AddressSuggestion,
  AddressSuggestionsResponse,
  AddressUpdateResponse,
  ConsentSetting,
  HouseholdDetails,
  RetrievedAddress,
} from "@/types/account";

import { ErrorView, LoadingView } from "../../components/page-state";
import { useAccountProfile } from "../../hooks/use-account-profile";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { ApiClientError, fetchJson } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-config";
import { useCountryCode, useLanguageCode, useTranslations } from "../../providers/country-context";
import { applyConsentUpdate, setOptimisticConsentDecision } from "./account-profile-cache";
import { getConsentDisplayText } from "./consent-display";

type DetailRowProps = {
  label: string;
  value: string | number | null | undefined;
};

type ConsentCategoryId = "newsletter" | "push" | "privacy";

type ConsentCategory = {
  id: ConsentCategoryId;
  label: string;
  settings: PreferenceSetting[];
};

type PreferenceSetting = { kind: "consent"; id: string; setting: ConsentSetting };

type SavedAddressDetails = AddressSpecificationRequest["addressSpecification"];

type SavedDeliveryAddressProfile = {
  id: string;
  savedAt: number;
  updatedAt: number;
  countryCode: string;
  address: RetrievedAddress;
  deliveryInstruction: string | null;
  addressSpecification: SavedAddressDetails;
};

type SavedDeliveryAddressDetails = Pick<
  SavedDeliveryAddressProfile,
  "deliveryInstruction" | "addressSpecification"
>;

const NEWSLETTER_CONSENT_TEXT_IDS = new Set([
  "f82ad0a2-97ba-41a1-a2a3-833aa59affbe",
  "ec6ab75a-a246-4ae2-b631-1afde465353e",
]);
const PUSH_CONSENT_TEXT_IDS = new Set(["7759b7d5-fb63-474c-9452-f7f2673924dc"]);
const SAVED_DELIVERY_ADDRESS_LIMIT = 3;
const DEFAULT_ADDRESS_SPECIFICATION_FIELDS = [
  "delivery_instruction",
  "building_type",
  "building_identifier",
  "floor",
  "front_door_guidance",
  "elevator",
] as const;

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
  const savedAddressOwnerId = user.user_id ?? profile.userInfo.user_id ?? null;
  const [savedDeliveryProfiles, setSavedDeliveryProfiles] = useState<SavedDeliveryAddressProfile[]>(
    () => readSavedDeliveryProfiles(countryCode, savedAddressOwnerId)
  );
  const [selectedDetailsProfileId, setSelectedDetailsProfileId] = useState<string | null>(null);
  const [currentAddressDetails, setCurrentAddressDetails] =
    useState<SavedDeliveryAddressDetails | null>(null);
  const [highlightAddressDetails, setHighlightAddressDetails] = useState(false);
  const displayName =
    profile.profileMenu.user?.name ??
    [user.firstname, user.lastname].filter(Boolean).join(" ") ??
    null;
  const address = user.address ?? profile.profileMenu.user?.address ?? null;
  const editableConsentSettings = mergeConsentSettings(
    profile.generalConsentSettings,
    profile.consentSettings
  )
    .filter(isEditableConsentSetting)
    .filter((setting) => !isPushConsentSetting(setting));
  const consentCategories = groupConsentSettings(editableConsentSettings, t);
  const currentAvatarUrl =
    profile.currentAvatar?.image_url ?? profile.profileMenu.user?.avatar?.image_url ?? null;
  const nameMutation = useMutation({
    mutationFn: (name: { firstname: string; lastname: string }) =>
      fetchJson<AccountNameUpdateResponse>("/api/account/name", {
        method: "PUT",
        body: JSON.stringify(name),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<AccountProfileResponse>(
        queryKeys.accountProfile(countryCode),
        (current) =>
          current
            ? {
                ...current,
                user: data.user,
                profileMenu: data.profileMenu,
              }
            : current
      );
    },
  });
  const avatarMutation = useMutation({
    mutationFn: (avatar: { type: "STANDARD_SELECTED" | "USER_DEFINED"; image_id: string }) =>
      fetchJson<AccountAvatarUpdateResponse>("/api/account/avatar", {
        method: "PUT",
        body: JSON.stringify(avatar),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<AccountProfileResponse>(
        queryKeys.accountProfile(countryCode),
        (current) =>
          current
            ? {
                ...current,
                currentAvatar: accountAvatarFromUpdate(data),
                profileMenu: data.profileMenu,
              }
            : current
      );
    },
  });
  const avatarUploadMutation = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.set("avatar", file);
      return fetchJson<AccountAvatarUpdateResponse>("/api/account/avatar-upload", {
        method: "POST",
        body,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AccountProfileResponse>(
        queryKeys.accountProfile(countryCode),
        (current) =>
          current
            ? {
                ...current,
                currentAvatar: accountAvatarFromUpdate(data),
                profileMenu: data.profileMenu,
              }
            : current
      );
    },
  });
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
  const addressMutation = useMutation({
    mutationFn: (selectedAddress: RetrievedAddress) =>
      fetchJson<AddressUpdateResponse>("/api/account/address", {
        method: "PUT",
        body: JSON.stringify({ address: selectedAddress }),
      }),
    onSuccess: (data, selectedAddress) => {
      queryClient.setQueryData<AccountProfileResponse>(
        queryKeys.accountProfile(countryCode),
        (current) => (current ? { ...current, user: data.user } : current)
      );
      setSavedDeliveryProfiles((current) => {
        const profiles = upsertSavedDeliveryProfile(countryCode, current, selectedAddress, null);
        const selectedProfile = profiles.find(
          (profile) => profile.address.id === selectedAddress.id
        );
        setSelectedDetailsProfileId(selectedProfile?.id ?? selectedAddress.id);
        return writeSavedDeliveryProfiles(countryCode, savedAddressOwnerId, profiles);
      });
    },
  });
  const addressSpecificationMutation = useMutation({
    mutationFn: (request: AddressSpecificationRequest) =>
      fetchJson<AddressSpecificationResponse>("/api/account/address-specification", {
        method: "PUT",
        body: JSON.stringify(request),
      }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<AddressSpecificationResponse>(
        ["address-specification", countryCode, variables.addressId],
        data
      );
      setSavedDeliveryProfiles((current) =>
        writeSavedDeliveryProfiles(
          countryCode,
          savedAddressOwnerId,
          updateSavedDeliveryProfileDetails(current, variables)
        )
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.accountProfile(countryCode) });
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
          general_consent: false,
        }),
      }),
    onMutate: async (setting) => {
      const queryKey = queryKeys.accountProfile(countryCode);
      await queryClient.cancelQueries({ queryKey });

      const previousDecision = setting.established_decision === true;
      queryClient.setQueryData<AccountProfileResponse>(queryKey, (current) =>
        current ? setOptimisticConsentDecision(current, setting, !previousDecision) : current
      );

      return { previousDecision };
    },
    onError: (_error, setting, context) => {
      if (!context) return;

      queryClient.setQueryData<AccountProfileResponse>(
        queryKeys.accountProfile(countryCode),
        (current) =>
          current
            ? setOptimisticConsentDecision(current, setting, context.previousDecision)
            : current
      );
    },
    onSuccess: (data, setting) => {
      queryClient.setQueryData<AccountProfileResponse>(
        queryKeys.accountProfile(countryCode),
        (current) => (current ? applyConsentUpdate(current, setting, data) : current)
      );
    },
  });
  useEffect(() => {
    setSavedDeliveryProfiles(readSavedDeliveryProfiles(countryCode, savedAddressOwnerId));
    setSelectedDetailsProfileId(null);
  }, [countryCode, savedAddressOwnerId]);

  const selectedDetailsProfile =
    savedDeliveryProfiles.find((profile) => profile.id === selectedDetailsProfileId) ?? null;
  const activeSavedDeliveryProfile = savedDeliveryProfiles.find((profile) =>
    accountAddressMatchesRetrieved(address ?? {}, profile.address)
  );
  const selectedDetailsProfileIsActive =
    selectedDetailsProfile !== null &&
    accountAddressMatchesRetrieved(address ?? {}, selectedDetailsProfile.address);
  const detailsAddressId =
    selectedDetailsProfile && !selectedDetailsProfileIsActive
      ? selectedDetailsProfile.address.id
      : (address?.id ?? null);

  useEffect(() => {
    if (
      selectedDetailsProfileId &&
      !savedDeliveryProfiles.some((profile) => profile.id === selectedDetailsProfileId)
    ) {
      setSelectedDetailsProfileId(null);
    }
  }, [savedDeliveryProfiles, selectedDetailsProfileId]);

  useEffect(() => {
    if (!selectedDetailsProfileId && activeSavedDeliveryProfile) {
      setSelectedDetailsProfileId(activeSavedDeliveryProfile.id);
    }
  }, [activeSavedDeliveryProfile, selectedDetailsProfileId]);

  useEffect(() => {
    if (!highlightAddressDetails) return;
    const timeoutId = window.setTimeout(() => setHighlightAddressDetails(false), 900);
    return () => window.clearTimeout(timeoutId);
  }, [highlightAddressDetails]);

  function drawAttentionToAddressDetails() {
    setHighlightAddressDetails(false);
    window.requestAnimationFrame(() => setHighlightAddressDetails(true));
  }

  async function applySavedDeliveryProfile(profile: SavedDeliveryAddressProfile) {
    try {
      addressMutation.reset();
      addressSpecificationMutation.reset();
      const result = await addressMutation.mutateAsync(profile.address);
      const activeAddressId = result.user.address?.id;
      if (!activeAddressId || !hasMeaningfulSavedAddressDetails(profile)) return;
      await addressSpecificationMutation.mutateAsync({
        addressId: activeAddressId,
        deliveryInstruction: profile.deliveryInstruction,
        addressSpecification: profile.addressSpecification,
      });
    } catch {
      // The mutation state already drives the visible error messages.
    }
  }

  function removeSavedDeliveryProfile(profileId: string) {
    if (selectedDetailsProfileId === profileId) setSelectedDetailsProfileId(null);
    setSavedDeliveryProfiles((current) =>
      writeSavedDeliveryProfiles(
        countryCode,
        savedAddressOwnerId,
        current.filter((profile) => profile.id !== profileId)
      )
    );
  }

  function saveResolvedCurrentAddress(resolvedAddress: RetrievedAddress) {
    setSavedDeliveryProfiles((current) => {
      const profiles = upsertSavedDeliveryProfile(
        countryCode,
        current,
        resolvedAddress,
        currentAddressDetails
      );
      const selectedProfile = profiles.find((profile) => profile.address.id === resolvedAddress.id);
      setSelectedDetailsProfileId(selectedProfile?.id ?? resolvedAddress.id);
      return writeSavedDeliveryProfiles(countryCode, savedAddressOwnerId, profiles);
    });
  }

  function saveAddressBookOnly(resolvedAddress: RetrievedAddress) {
    setSavedDeliveryProfiles((current) => {
      const profiles = upsertSavedDeliveryProfile(countryCode, current, resolvedAddress, null);
      const selectedProfile = profiles.find((profile) => profile.address.id === resolvedAddress.id);
      setSelectedDetailsProfileId(selectedProfile?.id ?? resolvedAddress.id);
      return writeSavedDeliveryProfiles(countryCode, savedAddressOwnerId, profiles);
    });
  }

  function saveAddressDetails(request: AddressSpecificationRequest) {
    if (selectedDetailsProfile && !selectedDetailsProfileIsActive) {
      setSavedDeliveryProfiles((current) =>
        writeSavedDeliveryProfiles(
          countryCode,
          savedAddressOwnerId,
          updateSavedDeliveryProfileDetails(current, request)
        )
      );
      return;
    }

    const activeAddressId = address?.id;
    if (selectedDetailsProfile) {
      setSavedDeliveryProfiles((current) =>
        writeSavedDeliveryProfiles(
          countryCode,
          savedAddressOwnerId,
          updateSavedDeliveryProfileDetails(current, {
            ...request,
            addressId: selectedDetailsProfile.address.id,
          })
        )
      );
    }
    addressSpecificationMutation.mutate({
      ...request,
      addressId: activeAddressId ?? request.addressId,
    });
  }

  return (
    <div className="space-y-5">
      <section className="border-card-border bg-card-bg rounded-xl border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <AvatarPicker
            name={displayName}
            currentAvatar={{
              type: profile.currentAvatar?.type ?? profile.profileMenu.user?.avatar?.type ?? null,
              image_id:
                profile.currentAvatar?.image_id ??
                profile.profileMenu.user?.avatar?.image_id ??
                null,
              image_url: currentAvatarUrl,
            }}
            isSaving={avatarMutation.isPending || avatarUploadMutation.isPending}
            error={avatarMutation.isError ? t.accountAvatarSaveError : null}
            uploadError={avatarUploadMutation.isError ? t.accountAvatarUploadError : null}
            onSelect={(avatar) => avatarMutation.mutate(avatar)}
            onUpload={(file) => avatarUploadMutation.mutate(file)}
          />
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
          <InfoSection title={t.accountAddressTitle}>
            <AddressEditor
              address={address}
              savedProfiles={savedDeliveryProfiles}
              currentAddressDetails={currentAddressDetails}
              isSavingAddress={addressMutation.isPending || addressSpecificationMutation.isPending}
              addressError={addressMutation.isError ? t.accountAddressSaveError : null}
              onSaveAddressBookOnly={saveAddressBookOnly}
              onSaveCurrentAddress={saveResolvedCurrentAddress}
              onApplySavedProfile={(savedProfile) => {
                setSelectedDetailsProfileId(savedProfile.id);
                void applySavedDeliveryProfile(savedProfile);
              }}
              selectedDetailsProfileId={selectedDetailsProfileId}
              onSelectDetailsProfile={setSelectedDetailsProfileId}
              onRequestDetailsAttention={drawAttentionToAddressDetails}
              onRemoveSavedProfile={removeSavedDeliveryProfile}
            />
          </InfoSection>

          {detailsAddressId ? (
            <InfoSection
              title={t.accountAddressSpecificationTitle}
              className={highlightAddressDetails ? "account-details-attention" : ""}
            >
              <AddressSpecificationEditor
                addressId={detailsAddressId}
                fallbackDetails={selectedDetailsProfile}
                useLocalDetailsOnly={
                  selectedDetailsProfile !== null && !selectedDetailsProfileIsActive
                }
                canUseBusinessBuildingType={user.customer_type === "BUSINESS"}
                isSaving={addressSpecificationMutation.isPending}
                error={
                  (!selectedDetailsProfile || selectedDetailsProfileIsActive) &&
                  addressSpecificationMutation.isError
                    ? t.accountAddressSpecificationSaveError
                    : null
                }
                onSave={saveAddressDetails}
                onCurrentDetailsChange={(details) => {
                  if (!selectedDetailsProfile) setCurrentAddressDetails(details);
                }}
              />
            </InfoSection>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <InfoSection title={t.accountDetailsTitle}>
            <div className="space-y-4">
              <NameEditor
                firstname={user.firstname ?? ""}
                lastname={user.lastname ?? ""}
                isSaving={nameMutation.isPending}
                error={nameMutation.isError ? t.accountNameSaveError : null}
                onSave={(name) => nameMutation.mutate(name)}
              />
              <DetailList>
                <DetailRow
                  label={t.accountCustomerTypeLabel}
                  value={formatCustomerType(user.customer_type, t)}
                />
              </DetailList>
            </div>
          </InfoSection>

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
      </div>

      <InfoSection title={t.accountPreferencesTitle}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {consentCategories.map((category) => (
            <PreferenceSummary
              key={category.id}
              label={category.label}
              value={formatEnabledOutOfTotal(category.settings, t)}
            />
          ))}
        </div>
        <ConsentSettingsList
          categories={consentCategories}
          pendingTextId={
            consentMutation.isPending && consentMutation.variables
              ? `consent:${consentMutation.variables.text_id ?? consentMutation.variables.id ?? ""}`
              : null
          }
          error={consentMutation.isError ? t.accountConsentSaveError : null}
          onToggle={(setting) => consentMutation.mutate(setting.setting)}
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

function PreferenceSummary({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border-card-border bg-muted-bg rounded-lg border px-3 py-2">
      <div className="text-muted text-xs">{label}</div>
      <div className="text-foreground mt-1 text-sm font-semibold">{value}</div>
      {note ? <div className="text-muted mt-1 text-xs">{note}</div> : null}
    </div>
  );
}

function NameEditor({
  firstname,
  lastname,
  isSaving,
  error,
  onSave,
}: {
  firstname: string;
  lastname: string;
  isSaving: boolean;
  error: string | null;
  onSave: (name: { firstname: string; lastname: string }) => void;
}) {
  const t = useTranslations();
  const [values, setValues] = useState({ firstname, lastname });
  const currentValues = useMemo(() => ({ firstname, lastname }), [firstname, lastname]);
  const isChanged =
    values.firstname.trim() !== currentValues.firstname.trim() ||
    values.lastname.trim() !== currentValues.lastname.trim();

  useEffect(() => {
    setValues(currentValues);
  }, [currentValues]);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        if (isChanged && !isSaving) {
          onSave({
            firstname: values.firstname.trim(),
            lastname: values.lastname.trim(),
          });
        }
      }}
    >
      <p className="text-muted text-sm">{t.accountNameEditNote}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted block text-sm font-medium">
          {t.accountFirstNameLabel}
          <RequiredIndicator label={t.requiredFieldLabel} />
          <input
            required
            type="text"
            value={values.firstname}
            onChange={(event) =>
              setValues((current) => ({ ...current, firstname: event.target.value }))
            }
            className="border-input-border bg-card-bg text-foreground mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-muted block text-sm font-medium">
          {t.accountLastNameLabel}
          <input
            type="text"
            value={values.lastname}
            onChange={(event) =>
              setValues((current) => ({ ...current, lastname: event.target.value }))
            }
            className="border-input-border bg-card-bg text-foreground mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
      </div>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={!isChanged || isSaving || values.firstname.trim().length === 0}
        className="bg-picnic-red rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isSaving ? t.accountSavingChanges : t.accountSaveChanges}
      </button>
    </form>
  );
}

function AvatarPicker({
  name,
  currentAvatar,
  isSaving,
  error,
  uploadError,
  onSelect,
  onUpload,
}: {
  name: string | null;
  currentAvatar: {
    type?: string | null;
    image_id?: string | null;
    image_url?: string | null;
  };
  isSaving: boolean;
  error: string | null;
  uploadError: string | null;
  onSelect: (avatar: { type: "STANDARD_SELECTED" | "USER_DEFINED"; image_id: string }) => void;
  onUpload: (file: File) => void;
}) {
  const t = useTranslations();
  const countryCode = useCountryCode();
  const [isOpen, setIsOpen] = useState(false);
  const uploadInputId = "account-avatar-upload";
  const pickerRef = useRef<HTMLDivElement>(null);
  const avatarOptionsQuery = useQuery({
    queryKey: ["avatar-options", countryCode],
    queryFn: () => fetchJson<AccountAvatarOptionsResponse>("/api/account/avatar-options"),
    enabled: isOpen,
    staleTime: 20 * 60 * 1000,
  });
  const currentAvatarType =
    currentAvatar.type === "USER_DEFINED" || currentAvatar.type === "STANDARD_SELECTED"
      ? currentAvatar.type
      : "STANDARD_SELECTED";

  useEffect(() => {
    if (!isOpen) return;

    function closePicker(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    document.addEventListener("mousedown", closePicker);
    return () => document.removeEventListener("mousedown", closePicker);
  }, [isOpen]);

  return (
    <div ref={pickerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="group focus-visible:ring-picnic-red focus-visible:ring-offset-card-bg relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        aria-expanded={isOpen}
        aria-label={t.accountAvatarChange}
      >
        <Avatar name={name} imageUrl={currentAvatar.image_url} />
        <span
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100 group-focus-visible:bg-black/35 group-focus-visible:opacity-100"
          aria-hidden="true"
        >
          <PencilIcon className="h-6 w-6 drop-shadow-sm" />
        </span>
      </button>
      {isOpen ? (
        <div className="border-card-border bg-card-bg absolute top-full left-0 z-50 mt-3 w-72 max-w-[calc(100vw-3rem)] rounded-xl border p-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-foreground text-sm font-semibold">{t.accountAvatarTitle}</h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted hover:text-foreground text-sm font-semibold transition-colors"
            >
              {t.accountAvatarClose}
            </button>
          </div>
          {avatarOptionsQuery.isPending ? (
            <p className="text-muted mt-3 text-sm">{t.loadingAriaLabel}...</p>
          ) : null}
          {avatarOptionsQuery.isError ? (
            <p className="mt-3 text-sm font-medium text-red-600">{t.accountAvatarLoadError}</p>
          ) : null}
          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
          {uploadError ? (
            <p className="mt-3 text-sm font-medium text-red-600">{uploadError}</p>
          ) : null}
          <div className="border-card-border mt-3 border-t pt-3">
            <label
              htmlFor={uploadInputId}
              className={`bg-picnic-red inline-flex cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors ${
                isSaving ? "pointer-events-none opacity-60" : "hover:bg-red-700"
              }`}
            >
              {t.accountAvatarUpload}
            </label>
            <input
              id={uploadInputId}
              type="file"
              accept="image/jpeg,image/png"
              disabled={isSaving}
              className="sr-only"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onUpload(file);
              }}
            />
            <p className="text-muted mt-2 text-xs">{t.accountAvatarUploadNote}</p>
          </div>
          {avatarOptionsQuery.data?.avatars.length ? (
            <div className="mt-3 grid max-h-72 grid-cols-5 gap-2 overflow-y-auto pr-1">
              {avatarOptionsQuery.data.avatars.map((avatar) => {
                const isSelected =
                  currentAvatar.type === "STANDARD_SELECTED" &&
                  currentAvatar.image_id === avatar.image_id;
                return (
                  <button
                    key={avatar.image_id}
                    type="button"
                    disabled={isSaving || isSelected}
                    onClick={() =>
                      onSelect({ type: "STANDARD_SELECTED", image_id: avatar.image_id })
                    }
                    className={`rounded-full border p-0.5 transition-colors disabled:cursor-not-allowed ${
                      isSelected
                        ? "border-picnic-red ring-picnic-red/25 ring-2"
                        : "border-card-border hover:border-picnic-red"
                    }`}
                    title={avatar.name ?? t.accountAvatarChange}
                  >
                    <img
                      src={avatar.image_url}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
          {currentAvatar.image_id && currentAvatar.type === "USER_DEFINED" ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                onSelect({ type: currentAvatarType, image_id: currentAvatar.image_id ?? "" })
              }
              className="border-card-border text-foreground hover:border-picnic-red mt-3 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60"
            >
              {t.accountAvatarKeepCustom}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AddressEditor({
  address,
  savedProfiles,
  currentAddressDetails,
  isSavingAddress,
  addressError,
  onSaveAddressBookOnly,
  onSaveCurrentAddress,
  onApplySavedProfile,
  selectedDetailsProfileId,
  onSelectDetailsProfile,
  onRequestDetailsAttention,
  onRemoveSavedProfile,
}: {
  address: AccountAddress | null;
  savedProfiles: SavedDeliveryAddressProfile[];
  currentAddressDetails: SavedDeliveryAddressDetails | null;
  isSavingAddress: boolean;
  addressError: string | null;
  onSaveAddressBookOnly: (address: RetrievedAddress) => void;
  onSaveCurrentAddress: (address: RetrievedAddress) => void;
  onApplySavedProfile: (profile: SavedDeliveryAddressProfile) => void;
  selectedDetailsProfileId: string | null;
  onSelectDetailsProfile: (profileId: string | null) => void;
  onRequestDetailsAttention: () => void;
  onRemoveSavedProfile: (profileId: string) => void;
}) {
  const t = useTranslations();
  const countryCode = useCountryCode();
  const [query, setQuery] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<AddressSuggestion | null>(null);
  const [retrievedAddress, setRetrievedAddress] = useState<RetrievedAddress | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const addressSearchRef = useRef<HTMLDivElement>(null);
  const selectedSuggestionNeedsHouseNumber = selectedSuggestion?.feature_type === "street";
  const savedAddressBookIsFull = savedProfiles.length >= SAVED_DELIVERY_ADDRESS_LIMIT;
  const suggestionsQuery = useQuery({
    queryKey: ["address-suggestions", countryCode, query.trim()],
    queryFn: () =>
      fetchJson<AddressSuggestionsResponse>(
        `/api/account/address/suggestions?q=${encodeURIComponent(query.trim())}`
      ),
    enabled: !savedAddressBookIsFull && query.trim().length >= 3,
    placeholderData: (previousData, previousQuery) => {
      const previousTerm = previousQuery?.queryKey[2];
      return typeof previousTerm === "string" && query.trim().startsWith(previousTerm)
        ? previousData
        : undefined;
    },
    staleTime: 60_000,
    retry: false,
  });
  const retrieveMutation = useMutation({
    mutationFn: (addressId: string) =>
      fetchJson<AddressRetrieveResponse>("/api/account/address/retrieve", {
        method: "POST",
        body: JSON.stringify({ addressId }),
      }),
    onSuccess: (data) => setRetrievedAddress(data.address),
  });
  const saveCurrentAddressMutation = useMutation({
    mutationFn: () => resolveCurrentAddress(address, countryCode),
    onSuccess: (resolvedAddress) => onSaveCurrentAddress(resolvedAddress),
  });
  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const currentAddressIsSaved = savedProfiles.some((profile) =>
    accountAddressMatchesRetrieved(address ?? {}, profile.address)
  );
  const retrievedSavedProfile = retrievedAddress
    ? (savedProfiles.find((profile) => profile.address.id === retrievedAddress.id) ?? null)
    : null;
  const retrievedAddressCanBeUsed =
    retrievedSavedProfile !== null && hasRequiredBuildingType(retrievedSavedProfile);
  const displayedSavedProfiles = [...savedProfiles].sort((left, right) => {
    const leftIsActive = accountAddressMatchesRetrieved(address ?? {}, left.address);
    const rightIsActive = accountAddressMatchesRetrieved(address ?? {}, right.address);
    return Number(rightIsActive) - Number(leftIsActive);
  });
  const hasSuggestionOverlay =
    showSuggestions &&
    query.trim().length >= 3 &&
    (suggestionsQuery.isFetching || suggestionsQuery.isError || suggestions.length > 0);

  useEffect(() => {
    function closeSuggestions(event: MouseEvent) {
      if (!addressSearchRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", closeSuggestions);
    return () => document.removeEventListener("mousedown", closeSuggestions);
  }, []);

  useEffect(() => {
    if (savedAddressBookIsFull) clearSelectedAddress();
  }, [savedAddressBookIsFull]);

  function clearSelectedAddress() {
    setSelectedSuggestion(null);
    setRetrievedAddress(null);
    setQuery("");
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  }

  function selectSuggestion(suggestion: AddressSuggestion) {
    if (savedAddressBookIsFull) return;
    setSelectedSuggestion(suggestion);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    setRetrievedAddress(null);
    if (suggestion.feature_type !== "street") {
      retrieveMutation.mutate(suggestion.address_id);
    }
  }

  function handleSuggestionKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!hasSuggestionOverlay || suggestions.length === 0) {
      if (event.key === "Escape") setShowSuggestions(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const suggestion = suggestions[activeSuggestionIndex];
      if (suggestion) selectSuggestion(suggestion);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  }

  return (
    <div className="space-y-5">
      <DetailList>
        <DetailRow label={t.accountCurrentAddressLabel} value={formatAddress(address, null)} />
      </DetailList>

      <div className="border-card-border border-t pt-4">
        <h3 className="text-foreground text-sm font-semibold">{t.accountSavedAddressesTitle}</h3>
        <p className="text-muted mt-1 text-sm">{t.accountSavedAddressesNote}</p>
        {!currentAddressIsSaved ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => saveCurrentAddressMutation.mutate()}
              disabled={
                !address ||
                !currentAddressDetails ||
                savedAddressBookIsFull ||
                isSavingAddress ||
                saveCurrentAddressMutation.isPending
              }
              className="border-card-border text-foreground hover:border-picnic-red rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {saveCurrentAddressMutation.isPending
                ? t.accountSavingChanges
                : t.accountSavedAddressSaveCurrent}
            </button>
            {saveCurrentAddressMutation.isError ? (
              <p className="mt-2 text-sm font-medium text-red-600">
                {t.accountSavedAddressSaveCurrentError}
              </p>
            ) : null}
          </div>
        ) : null}
        {displayedSavedProfiles.length ? (
          <div className="mt-3 space-y-2">
            {displayedSavedProfiles.map((profile) => {
              const isActive = accountAddressMatchesRetrieved(address ?? {}, profile.address);
              const isSelectedForDetails = selectedDetailsProfileId === profile.id;
              const detailsSummary = formatSavedAddressDetails(profile, t);
              const canUseProfile = hasRequiredBuildingType(profile);
              return (
                <div
                  key={profile.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectDetailsProfile(isSelectedForDetails ? null : profile.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectDetailsProfile(isSelectedForDetails ? null : profile.id);
                    }
                  }}
                  className={`bg-background cursor-pointer rounded-lg border p-3 transition-colors ${
                    isSelectedForDetails
                      ? "border-picnic-red ring-picnic-red/20 ring-2"
                      : "border-card-border hover:border-picnic-red"
                  }`}
                >
                  <div
                    className={`flex flex-col gap-2 sm:flex-row sm:justify-between ${
                      detailsSummary ? "sm:items-start" : "sm:items-center"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-foreground text-sm font-semibold">
                          {formatRetrievedAddress(profile.address)}
                        </p>
                      </div>
                      {detailsSummary ? (
                        <p className="text-muted mt-0.5 text-xs">{detailsSummary}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (canUseProfile) {
                            onApplySavedProfile(profile);
                          } else {
                            onSelectDetailsProfile(profile.id);
                            onRequestDetailsAttention();
                          }
                        }}
                        disabled={isSavingAddress || isActive}
                        title={!canUseProfile ? t.accountSavedAddressNeedsBuildingType : undefined}
                        className="bg-picnic-red rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                      >
                        {isActive
                          ? t.accountSavedAddressInUse
                          : canUseProfile
                            ? t.accountSavedAddressUse
                            : t.accountSavedAddressCompleteDetails}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveSavedProfile(profile.id);
                        }}
                        disabled={isSavingAddress}
                        className="border-card-border text-foreground hover:border-picnic-red rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60"
                      >
                        {t.accountSavedAddressRemove}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted mt-3 text-sm">{t.accountSavedAddressesEmpty}</p>
        )}
      </div>

      <div className="border-card-border border-t pt-4">
        <p className="text-muted text-sm">{t.accountAddressEditNote}</p>
        {savedAddressBookIsFull ? (
          <p className="text-muted mt-3 text-sm font-medium">{t.accountSavedAddressesFull}</p>
        ) : null}
        <div ref={addressSearchRef} className="relative mt-3">
          <label htmlFor="account-address-search" className="text-muted block text-sm font-medium">
            {t.accountAddressSearchLabel}
          </label>
          <input
            id="account-address-search"
            type="search"
            disabled={savedAddressBookIsFull}
            value={query}
            onChange={(event) => {
              if (savedAddressBookIsFull) return;
              setQuery(event.target.value);
              setShowSuggestions(true);
              setActiveSuggestionIndex(-1);
              setSelectedSuggestion(null);
              setRetrievedAddress(null);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleSuggestionKeyDown}
            placeholder={t.accountAddressSearchPlaceholder}
            className="border-input-border bg-card-bg text-foreground mt-1 block w-full rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          />

          {hasSuggestionOverlay ? (
            <div className="border-card-border bg-card-bg absolute top-full left-0 z-40 mt-1 w-full overflow-hidden rounded-lg border shadow-lg">
              {suggestionsQuery.isFetching ? (
                <p className="text-muted px-3 py-2 text-sm">{t.loadingAriaLabel}...</p>
              ) : null}
              {suggestionsQuery.isError ? (
                <p className="px-3 py-2 text-sm font-medium text-red-600">
                  {t.accountAddressSearchError}
                </p>
              ) : null}
              {suggestions.length ? (
                <div className="max-h-72 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.address_id}
                      type="button"
                      onClick={() => selectSuggestion(suggestion)}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      className={`hover:bg-background text-foreground w-full px-3 py-2 text-left transition-colors ${
                        selectedSuggestion?.address_id === suggestion.address_id ||
                        activeSuggestionIndex === index
                          ? "bg-background"
                          : ""
                      }`}
                    >
                      <span className="block text-sm font-semibold">{suggestion.name}</span>
                      <span className="text-muted block text-xs">
                        {[suggestion.postcode, suggestion.place].filter(Boolean).join(" ")}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {selectedSuggestionNeedsHouseNumber ? (
          <p className="text-muted mt-2 text-sm">{t.accountAddressNeedsHouseNumber}</p>
        ) : null}
        {retrieveMutation.isError ? (
          <p className="mt-2 text-sm font-medium text-red-600">{t.accountAddressRetrieveError}</p>
        ) : null}
        {retrievedAddress ? (
          <div className="border-card-border bg-background mt-3 rounded-lg border p-3">
            <p className="text-foreground text-sm font-semibold">
              {retrievedAddress.formatted_address ?? formatRetrievedAddress(retrievedAddress)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (retrievedAddressCanBeUsed && retrievedSavedProfile) {
                    onApplySavedProfile(retrievedSavedProfile);
                  } else {
                    onSaveAddressBookOnly(retrievedAddress);
                    clearSelectedAddress();
                  }
                }}
                disabled={isSavingAddress}
                className="bg-picnic-red rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-wait disabled:bg-gray-300 disabled:text-gray-500"
              >
                {isSavingAddress ? t.accountSavingChanges : t.accountAddressUseSelected}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveAddressBookOnly(retrievedAddress);
                  clearSelectedAddress();
                }}
                disabled={isSavingAddress}
                className="border-card-border text-foreground hover:border-picnic-red rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60"
              >
                {t.accountAddressSaveOnly}
              </button>
              <button
                type="button"
                onClick={clearSelectedAddress}
                disabled={isSavingAddress}
                className="border-card-border text-foreground hover:border-picnic-red rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60"
              >
                {t.accountAddressCancel}
              </button>
            </div>
          </div>
        ) : null}
        {addressError ? (
          <p className="mt-2 text-sm font-medium text-red-600">{addressError}</p>
        ) : null}
      </div>
    </div>
  );
}

function AddressSpecificationEditor({
  addressId,
  fallbackDetails,
  useLocalDetailsOnly,
  canUseBusinessBuildingType,
  isSaving,
  error,
  onSave,
  onCurrentDetailsChange,
}: {
  addressId: string;
  fallbackDetails: SavedDeliveryAddressDetails | null;
  useLocalDetailsOnly: boolean;
  canUseBusinessBuildingType: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: (request: AddressSpecificationRequest) => void;
  onCurrentDetailsChange: (details: SavedDeliveryAddressDetails) => void;
}) {
  const t = useTranslations();
  const countryCode = useCountryCode();
  const specificationQuery = useQuery({
    queryKey: ["address-specification", countryCode, addressId],
    queryFn: () =>
      fetchJson<AddressSpecificationResponse>(
        `/api/account/address-specification?addressId=${encodeURIComponent(addressId)}`
      ),
    enabled: !useLocalDetailsOnly,
    staleTime: 60_000,
  });
  const first = useLocalDetailsOnly ? null : (specificationQuery.data?.specifications[0] ?? null);
  const fields = new Set(
    useLocalDetailsOnly
      ? DEFAULT_ADDRESS_SPECIFICATION_FIELDS
      : (specificationQuery.data?.enabledFields ?? [])
  );
  const [values, setValues] = useState(() =>
    sanitizeSpecificationValues(
      specificationValues(first, fallbackDetails),
      canUseBusinessBuildingType
    )
  );
  const showBuildingSpecificFields = values.buildingType !== "" && values.buildingType !== "HOUSE";
  const currentValues = useMemo(
    () =>
      sanitizeSpecificationValues(
        specificationValues(first, fallbackDetails),
        canUseBusinessBuildingType
      ),
    [canUseBusinessBuildingType, fallbackDetails, first]
  );
  const isChanged = !areSpecificationValuesEqual(values, currentValues, showBuildingSpecificFields);
  const [showExtraInstruction, setShowExtraInstruction] = useState(
    () => currentValues.frontDoorGuidance.trim().length > 0
  );
  const extraInstructionToggleId = `account-extra-instruction-${addressId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const currentDetails = useMemo<SavedDeliveryAddressDetails>(
    () => ({
      deliveryInstruction: null,
      addressSpecification: specificationDetailsFromValues(currentValues),
    }),
    [currentValues]
  );

  useEffect(() => {
    setValues(currentValues);
    setShowExtraInstruction(currentValues.frontDoorGuidance.trim().length > 0);
  }, [currentValues]);

  useEffect(() => {
    onCurrentDetailsChange(currentDetails);
  }, [currentDetails, onCurrentDetailsChange]);

  function submit() {
    const submittedValues = sanitizeSpecificationValues(values, canUseBusinessBuildingType);
    onSave({
      addressId,
      deliveryInstruction: null,
      addressSpecification: specificationDetailsFromValues(
        submittedValues,
        showBuildingSpecificFields
      ),
    });
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        if (isChanged && !isSaving) submit();
      }}
    >
      <p className="text-muted text-sm">{t.accountAddressSpecificationNote}</p>
      {!useLocalDetailsOnly && specificationQuery.isPending ? (
        <p className="text-muted text-sm">{t.loadingAriaLabel}...</p>
      ) : null}
      {!useLocalDetailsOnly && specificationQuery.isError ? (
        <p className="mt-2 text-sm font-medium text-red-600">
          {t.accountAddressSpecificationLoadError}
        </p>
      ) : null}
      {useLocalDetailsOnly || specificationQuery.data ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {fields.has("building_type") ? (
            <label className="text-muted block text-sm font-medium">
              {t.accountBuildingTypeLabel}
              <RequiredIndicator label={t.requiredFieldLabel} />
              <select
                required
                value={values.buildingType}
                onChange={(event) =>
                  setValues((current) => ({ ...current, buildingType: event.target.value }))
                }
                className="border-input-border bg-card-bg text-foreground mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
              >
                {values.buildingType === "" ? (
                  <option value="">{t.accountUnknownValue}</option>
                ) : null}
                <option value="HOUSE">{t.accountBuildingTypeHouse}</option>
                <option value="APARTMENT">{t.accountBuildingTypeApartment}</option>
                {canUseBusinessBuildingType ? (
                  <option value="BUSINESS">{t.accountBuildingTypeBusiness}</option>
                ) : null}
              </select>
            </label>
          ) : null}
          {showBuildingSpecificFields && fields.has("building_identifier") ? (
            <TextInput
              label={t.accountBuildingNameLabel}
              value={values.buildingIdentifier}
              onChange={(value) =>
                setValues((current) => ({ ...current, buildingIdentifier: value }))
              }
            />
          ) : null}
          {showBuildingSpecificFields && fields.has("floor") ? (
            <FloorSelect
              label={t.accountFloorLabel}
              value={values.floor}
              onChange={(value) => setValues((current) => ({ ...current, floor: value }))}
            />
          ) : null}
          {showBuildingSpecificFields && fields.has("elevator") ? (
            <label className="text-muted flex min-h-[4.25rem] items-center gap-2 pt-6 text-sm font-medium">
              <input
                type="checkbox"
                checked={values.elevator}
                onChange={(event) =>
                  setValues((current) => ({ ...current, elevator: event.target.checked }))
                }
              />
              {t.accountElevatorLabel}
            </label>
          ) : null}
          {values.buildingType !== "" && fields.has("delivery_instruction") ? (
            <div className="text-muted flex items-center gap-2 text-sm font-medium sm:col-span-2">
              <input
                id={extraInstructionToggleId}
                type="checkbox"
                checked={showExtraInstruction}
                onChange={(event) => {
                  setShowExtraInstruction(event.target.checked);
                  if (!event.target.checked) {
                    setValues((current) => ({ ...current, frontDoorGuidance: "" }));
                  }
                }}
              />
              <label htmlFor={extraInstructionToggleId} className="cursor-pointer select-none">
                {t.accountExtraInstructionToggleLabel}
              </label>
            </div>
          ) : null}
          {values.buildingType !== "" &&
          showExtraInstruction &&
          fields.has("delivery_instruction") ? (
            <TextAreaInput
              label={t.accountExtraInstructionLabel}
              value={values.frontDoorGuidance}
              onChange={(value) =>
                setValues((current) => ({ ...current, frontDoorGuidance: value }))
              }
            />
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={isSaving || (!useLocalDetailsOnly && !specificationQuery.data) || !isChanged}
        className="bg-picnic-red mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isSaving ? t.accountSavingChanges : t.accountSaveChanges}
      </button>
    </form>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="text-muted block text-sm font-medium">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input-border bg-card-bg text-foreground mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
      />
    </label>
  );
}

function RequiredIndicator({ label }: { label: string }) {
  return (
    <span className="text-picnic-red ml-1" title={label} aria-label={label}>
      *
    </span>
  );
}

function TextAreaInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-muted block text-sm font-medium sm:col-span-2">
      {label}
      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="border-input-border bg-card-bg text-foreground mt-1 block min-h-28 w-full resize-none rounded-lg border px-3 py-2 text-sm"
      />
    </label>
  );
}

function FloorSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();

  return (
    <label className="text-muted block text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input-border bg-card-bg text-foreground mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">{t.accountUnknownValue}</option>
        {Array.from({ length: 55 }, (_, index) => index - 4).map((floor) => (
          <option key={floor} value={String(floor)}>
            {floor}
          </option>
        ))}
      </select>
    </label>
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
  categories,
  pendingTextId,
  error,
  onToggle,
}: {
  categories: ConsentCategory[];
  pendingTextId: string | null;
  error: string | null;
  onToggle: (setting: PreferenceSetting) => void;
}) {
  const t = useTranslations();
  const languageCode = useLanguageCode();
  const populatedCategories = categories.filter((category) => category.settings.length > 0);

  if (populatedCategories.length === 0) return null;

  return (
    <div className="border-card-border mt-4 space-y-3 border-t pt-4">
      <p className="text-muted text-sm">{t.accountEditableConsentsNote}</p>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <div className="space-y-4">
        {populatedCategories.map((category) => (
          <section key={category.id} className="space-y-2">
            <h3 className="text-foreground text-sm font-semibold">{category.label}</h3>
            <div className="grid gap-2 lg:grid-cols-2">
              {category.settings.map((setting) => {
                const checked = isPreferenceSettingEnabled(setting);
                const isPending = pendingTextId === preferenceSettingId(setting);
                const displayText = getPreferenceDisplayText(setting, languageCode);
                return (
                  <button
                    key={preferenceSettingId(setting)}
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
          </section>
        ))}
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

function accountAvatarFromUpdate(data: AccountAvatarUpdateResponse) {
  const profileAvatar = data.profileMenu.user?.avatar;
  return {
    ...data.avatar,
    type: data.avatar.type ?? profileAvatar?.type ?? null,
    image_id: data.avatar.image_id ?? profileAvatar?.image_id ?? null,
    image_url: data.avatar.image_url ?? profileAvatar?.image_url ?? null,
  };
}

function PencilIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Zm0 0L19.5 7.125"
      />
    </svg>
  );
}

function householdValues(household: HouseholdDetails | null) {
  return {
    adults: household?.adults ?? 0,
    children: household?.children ?? 0,
    cats: household?.cats ?? 0,
    dogs: household?.dogs ?? 0,
  };
}

function specificationValues(
  specification: AddressSpecificationResponse["specifications"][number] | null,
  fallbackDetails: SavedDeliveryAddressDetails | null = null
) {
  const details = specification?.address_specification;
  if (!specification && fallbackDetails) {
    return {
      deliveryInstruction: "",
      accessCodes: "",
      buildingType: fallbackDetails.addressSpecification.buildingType ?? "",
      buildingIdentifier: fallbackDetails.addressSpecification.buildingIdentifier ?? "",
      floor:
        fallbackDetails.addressSpecification.floor === null ||
        fallbackDetails.addressSpecification.floor === undefined
          ? ""
          : String(fallbackDetails.addressSpecification.floor),
      frontDoorGuidance: fallbackDetails.addressSpecification.frontDoorGuidance ?? "",
      elevator: fallbackDetails.addressSpecification.elevator === true,
    };
  }
  return {
    deliveryInstruction: "",
    accessCodes: "",
    buildingType: details?.building_type ?? "",
    buildingIdentifier: details?.building_identifier ?? "",
    floor: details?.floor === null || details?.floor === undefined ? "" : String(details.floor),
    frontDoorGuidance: details?.front_door_guidance ?? "",
    elevator: details?.elevator === true,
  };
}

function specificationDetailsFromValues(
  values: ReturnType<typeof specificationValues>,
  includeBuildingSpecificFields = true
): SavedAddressDetails {
  return {
    accessCodes: [],
    buildingType: values.buildingType || null,
    buildingIdentifier: includeBuildingSpecificFields ? values.buildingIdentifier : null,
    floor: includeBuildingSpecificFields && values.floor !== "" ? Number(values.floor) : null,
    frontDoorGuidance: includeBuildingSpecificFields ? values.frontDoorGuidance : null,
    elevator: includeBuildingSpecificFields ? values.elevator : null,
  };
}

function sanitizeSpecificationValues(
  values: ReturnType<typeof specificationValues>,
  canUseBusinessBuildingType: boolean
): ReturnType<typeof specificationValues> {
  if (canUseBusinessBuildingType || values.buildingType !== "BUSINESS") return values;
  return { ...values, buildingType: "" };
}

function areSpecificationValuesEqual(
  left: ReturnType<typeof specificationValues>,
  right: ReturnType<typeof specificationValues>,
  includeBuildingSpecificFields = true
): boolean {
  return (
    left.deliveryInstruction === right.deliveryInstruction &&
    left.buildingType === right.buildingType &&
    (!includeBuildingSpecificFields || left.buildingIdentifier === right.buildingIdentifier) &&
    (!includeBuildingSpecificFields || left.floor === right.floor) &&
    (!includeBuildingSpecificFields || left.frontDoorGuidance === right.frontDoorGuidance) &&
    (!includeBuildingSpecificFields || left.elevator === right.elevator)
  );
}

async function resolveCurrentAddress(
  address: AccountAddress | null,
  countryCode: string
): Promise<RetrievedAddress> {
  if (!address) throw new Error("Missing current address");

  const query = currentAddressSearchQuery(address);
  if (!query) throw new Error("Current address is incomplete");

  const suggestionsResponse = await fetchJson<AddressSuggestionsResponse>(
    `/api/account/address/suggestions?q=${encodeURIComponent(query)}`
  );
  const candidates = suggestionsResponse.suggestions
    .filter((suggestion) => suggestion.feature_type !== "street")
    .slice(0, 8);

  for (const candidate of candidates) {
    const retrieved = await fetchJson<AddressRetrieveResponse>("/api/account/address/retrieve", {
      method: "POST",
      body: JSON.stringify({ addressId: candidate.address_id }),
    });
    if (accountAddressMatchesRetrieved(address, retrieved.address)) return retrieved.address;
  }

  throw new Error(`Could not resolve current address for ${countryCode}`);
}

function currentAddressSearchQuery(address: AccountAddress): string {
  return [
    address.street,
    [address.house_number, address.house_number_ext].filter(Boolean).join(""),
    address.city,
  ]
    .filter((part): part is string => part !== null && part !== undefined && part !== "")
    .join(" ");
}

function accountAddressMatchesRetrieved(
  accountAddress: AccountAddress,
  retrievedAddress: RetrievedAddress
): boolean {
  return (
    normalizedAddressPart(accountAddress.street) ===
      normalizedAddressPart(retrievedAddress.street) &&
    normalizedAddressPart(accountAddress.city) === normalizedAddressPart(retrievedAddress.city) &&
    normalizedAddressPart(accountAddress.postcode).replace(/\s+/g, "") ===
      normalizedAddressPart(retrievedAddress.postcode).replace(/\s+/g, "") &&
    Number(accountAddress.house_number) === retrievedAddress.house_number &&
    normalizedAddressPart(accountAddress.house_number_ext) ===
      normalizedAddressPart(retrievedAddress.house_number_ext)
  );
}

function normalizedAddressPart(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readSavedDeliveryProfiles(
  countryCode: string,
  ownerId: string | null
): SavedDeliveryAddressProfile[] {
  if (typeof localStorage === "undefined" || !ownerId) return [];

  try {
    const value = localStorage.getItem(savedDeliveryProfileStorageKey(countryCode, ownerId));
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    return isSavedDeliveryProfileArray(parsed)
      ? writeSavedDeliveryProfiles(
          countryCode,
          ownerId,
          parsed.slice(0, SAVED_DELIVERY_ADDRESS_LIMIT).map(sanitizeSavedDeliveryProfile)
        )
      : [];
  } catch {
    return [];
  }
}

function writeSavedDeliveryProfiles(
  countryCode: string,
  ownerId: string | null,
  profiles: SavedDeliveryAddressProfile[]
): SavedDeliveryAddressProfile[] {
  const normalizedProfiles = profiles.slice(0, SAVED_DELIVERY_ADDRESS_LIMIT);
  if (typeof localStorage === "undefined" || !ownerId) return normalizedProfiles;
  try {
    localStorage.setItem(
      savedDeliveryProfileStorageKey(countryCode, ownerId),
      JSON.stringify(normalizedProfiles)
    );
  } catch {
    // Saved addresses are a local convenience only; ignore storage failures.
  }
  return normalizedProfiles;
}

function upsertSavedDeliveryProfile(
  countryCode: string,
  profiles: SavedDeliveryAddressProfile[],
  address: RetrievedAddress,
  details: Pick<SavedDeliveryAddressProfile, "deliveryInstruction" | "addressSpecification"> | null
): SavedDeliveryAddressProfile[] {
  const now = Date.now();
  const existing = profiles.find((profile) => profile.address.id === address.id);
  if (!existing && profiles.length >= SAVED_DELIVERY_ADDRESS_LIMIT) return profiles;
  const nextProfile: SavedDeliveryAddressProfile = {
    id: existing?.id ?? address.id,
    savedAt: existing?.savedAt ?? now,
    updatedAt: now,
    countryCode,
    address,
    deliveryInstruction: null,
    addressSpecification:
      details?.addressSpecification ?? existing?.addressSpecification ?? emptySavedAddressDetails(),
  };
  const remaining = profiles.filter((profile) => profile.address.id !== address.id);
  return [nextProfile, ...remaining];
}

function updateSavedDeliveryProfileDetails(
  profiles: SavedDeliveryAddressProfile[],
  request: AddressSpecificationRequest
): SavedDeliveryAddressProfile[] {
  return profiles.map((profile) =>
    profile.address.id === request.addressId
      ? {
          ...profile,
          updatedAt: Date.now(),
          deliveryInstruction: null,
          addressSpecification: request.addressSpecification,
        }
      : profile
  );
}

function hasMeaningfulSavedAddressDetails(profile: SavedDeliveryAddressProfile): boolean {
  const details = profile.addressSpecification;
  return (
    Boolean(details.buildingType) ||
    Boolean(details.buildingIdentifier?.trim()) ||
    (details.floor !== null && details.floor !== undefined) ||
    Boolean(details.frontDoorGuidance?.trim()) ||
    details.elevator === true
  );
}

function hasRequiredBuildingType(profile: SavedDeliveryAddressProfile): boolean {
  return Boolean(profile.addressSpecification.buildingType);
}

function sanitizeSavedDeliveryProfile(
  profile: SavedDeliveryAddressProfile
): SavedDeliveryAddressProfile {
  return {
    ...profile,
    deliveryInstruction: null,
    addressSpecification: {
      ...emptySavedAddressDetails(),
      ...profile.addressSpecification,
      accessCodes: [],
    },
  };
}

function emptySavedAddressDetails(): SavedAddressDetails {
  return {
    accessCodes: [],
    buildingType: null,
    buildingIdentifier: null,
    floor: null,
    frontDoorGuidance: null,
    elevator: null,
  };
}

function savedDeliveryProfileStorageKey(countryCode: string, ownerId: string): string {
  return `picnic_saved_delivery_addresses_${countryCode.toLowerCase()}_${encodeURIComponent(ownerId)}`;
}

function isSavedDeliveryProfileArray(value: unknown): value is SavedDeliveryAddressProfile[] {
  return (
    Array.isArray(value) &&
    value.every((profile) => {
      if (!profile || typeof profile !== "object") return false;
      const candidate = profile as Partial<SavedDeliveryAddressProfile>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.savedAt === "number" &&
        typeof candidate.updatedAt === "number" &&
        isRetrievedAddress(candidate.address)
      );
    })
  );
}

function isRetrievedAddress(value: unknown): value is RetrievedAddress {
  if (!value || typeof value !== "object") return false;
  const address = value as Partial<RetrievedAddress>;
  return (
    typeof address.id === "string" &&
    typeof address.city === "string" &&
    typeof address.street === "string" &&
    typeof address.house_number === "number" &&
    typeof address.postcode === "string" &&
    typeof address.signature === "string"
  );
}

function formatSavedAddressDetails(
  profile: SavedDeliveryAddressProfile,
  t: ReturnType<typeof useTranslations>
): string | null {
  const details = profile.addressSpecification;
  const parts = [
    details.buildingIdentifier,
    details.floor === null || details.floor === undefined
      ? null
      : `${t.accountFloorLabel} ${details.floor}`,
    details.elevator ? t.accountElevatorLabel : null,
  ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
  return parts.length ? parts.join(" · ") : null;
}

function mergeConsentSettings(...settingGroups: ConsentSetting[][]): ConsentSetting[] {
  const settings = new Map<string, ConsentSetting>();

  for (const setting of settingGroups.flat()) {
    const key = setting.text_id ?? setting.id;
    if (key && !settings.has(key)) settings.set(key, setting);
  }

  return [...settings.values()];
}

function groupConsentSettings(
  settings: ConsentSetting[],
  t: ReturnType<typeof useTranslations>
): ConsentCategory[] {
  const categories: ConsentCategory[] = [
    { id: "newsletter", label: t.accountSubscriptionsLabel, settings: [] },
    { id: "push", label: t.accountPushSubscriptionsLabel, settings: [] },
    { id: "privacy", label: t.accountConsentSettingsLabel, settings: [] },
  ];
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  for (const setting of settings) {
    const id = setting.text_id ?? setting.id;
    if (id) {
      categoryById.get(getConsentCategoryId(setting))?.settings.push({
        kind: "consent",
        id,
        setting,
      });
    }
  }

  return categories.filter((category) => category.settings.length > 0);
}

function getConsentCategoryId(setting: ConsentSetting): ConsentCategoryId {
  if (setting.text_id && NEWSLETTER_CONSENT_TEXT_IDS.has(setting.text_id)) return "newsletter";
  if (setting.text_id && PUSH_CONSENT_TEXT_IDS.has(setting.text_id)) return "push";
  return "privacy";
}

function formatEnabledOutOfTotal(
  settings: PreferenceSetting[],
  t: ReturnType<typeof useTranslations>
) {
  return t.accountEnabledOutOfTotal
    .replace("{enabled}", String(countEnabledPreferenceSettings(settings)))
    .replace("{total}", String(settings.length));
}

function countEnabledPreferenceSettings(settings: PreferenceSetting[]): number {
  return settings.filter(isPreferenceSettingEnabled).length;
}

function isEditableConsentSetting(setting: ConsentSetting): boolean {
  return (
    typeof setting.text_id === "string" &&
    typeof setting.text_locale === "string" &&
    typeof setting.established_decision === "boolean"
  );
}

function isPushConsentSetting(setting: ConsentSetting): boolean {
  return typeof setting.text_id === "string" && PUSH_CONSENT_TEXT_IDS.has(setting.text_id);
}

function isPreferenceSettingEnabled(setting: PreferenceSetting): boolean {
  return setting.setting.established_decision === true;
}

function preferenceSettingId(setting: PreferenceSetting): string {
  return `consent:${setting.setting.text_id ?? setting.setting.id ?? setting.id}`;
}

function getPreferenceDisplayText(
  setting: PreferenceSetting,
  languageCode: ReturnType<typeof useLanguageCode>
) {
  return getConsentDisplayText(setting.setting, languageCode);
}

function formatCustomerType(
  customerType: string | null | undefined,
  t: ReturnType<typeof useTranslations>
) {
  if (!customerType) return null;

  if (customerType === "CONSUMER") return t.accountCustomerTypeConsumer;
  if (customerType === "BUSINESS") return t.accountCustomerTypeBusiness;

  return customerType
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAddress(address: AccountAddress | null, fallback: string | null): string | null {
  if (!address) return fallback;
  const houseNumber = [address.house_number, address.house_number_ext].filter(Boolean).join("");
  const street = [address.street, houseNumber].filter(Boolean).join(" ");
  return [street, address.postcode, address.city].filter(Boolean).join(", ") || fallback;
}

function formatRetrievedAddress(address: RetrievedAddress): string {
  const houseNumber = [address.house_number, address.house_number_ext].filter(Boolean).join("");
  const street = [address.street, houseNumber].filter(Boolean).join(" ");
  return [street, address.postcode, address.city].filter(Boolean).join(", ");
}
