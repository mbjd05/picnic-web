import { useEffect, useState } from "react";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  DeliveryActionApiResponse,
  DeliveryDetail,
  DeliveryOrderStatusApiResponse,
  DeliverySummariesApiResponse,
  DeliverySummary,
  DeliveryTrackingApiResponse,
} from "@/lib/types/delivery";
import { formatPrice } from "@/lib/format-price";
import { buildImageUrl } from "@/lib/image-url";

import { ErrorView, LoadingView, useDocumentTitle } from "./browsing-components";
import { useCountryCode, useTranslations } from "./country-context";
import { ApiClientError, fetchJson } from "./lib/api-client";
import { queryKeys, queryStaleTime } from "./lib/query-config";

type DeliveryFilter = "current" | "all";

export function DeliveriesPage() {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const [filter, setFilter] = useState<DeliveryFilter>("current");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  useDocumentTitle(t.deliveriesTitle);

  const summariesQuery = useQuery({
    queryKey: queryKeys.deliveries(filter, countryCode),
    queryFn: () =>
      fetchJson<DeliverySummariesApiResponse>(
        filter === "current" ? "/api/deliveries?status=CURRENT" : "/api/deliveries"
      ),
    staleTime: queryStaleTime.deliveries,
  });

  const deliveries = summariesQuery.data?.deliveries ?? [];

  useEffect(() => {
    if (deliveries.length === 0) {
      setSelectedDeliveryId(null);
      return;
    }
    if (
      !selectedDeliveryId ||
      !deliveries.some((delivery) => delivery.deliveryId === selectedDeliveryId)
    ) {
      setSelectedDeliveryId(deliveries[0]?.deliveryId ?? null);
    }
  }, [deliveries, selectedDeliveryId]);

  const selectedSummary =
    deliveries.find((delivery) => delivery.deliveryId === selectedDeliveryId) ?? null;

  const detailQuery = useQuery({
    queryKey: selectedDeliveryId
      ? queryKeys.deliveryDetail(selectedDeliveryId, countryCode)
      : ["delivery-detail", "none", countryCode],
    queryFn: () => fetchJson<DeliveryDetail>(`/api/deliveries/${selectedDeliveryId}`),
    enabled: Boolean(selectedDeliveryId),
    staleTime: queryStaleTime.deliveryDetail,
  });

  const isCurrentDelivery = selectedSummary?.status === "CURRENT";
  const trackingQuery = useQuery({
    queryKey: selectedDeliveryId
      ? queryKeys.deliveryTracking(selectedDeliveryId, countryCode)
      : ["delivery-tracking", "none", countryCode],
    queryFn: () =>
      fetchJson<DeliveryTrackingApiResponse>(`/api/deliveries/${selectedDeliveryId}/tracking`),
    enabled: Boolean(selectedDeliveryId && isCurrentDelivery),
    staleTime: queryStaleTime.deliveryTracking,
    retry: false,
  });

  const summariesError =
    summariesQuery.error instanceof ApiClientError
      ? summariesQuery.error.message
      : t.deliveriesLoadError;
  const detailError =
    detailQuery.error instanceof ApiClientError
      ? detailQuery.error.message
      : t.deliveryDetailLoadError;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">{t.deliveriesTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.deliveriesSubtitle}</p>
        </div>
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {(["current", "all"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                filter === option ? "text-foreground bg-white shadow-sm" : "text-gray-500"
              }`}
              aria-pressed={filter === option}
            >
              {option === "current" ? t.deliveryCurrentFilter : t.deliveryAllFilter}
            </button>
          ))}
        </div>
      </div>

      {summariesQuery.isPending ? <LoadingView /> : null}
      {summariesQuery.isError ? (
        <ErrorView message={summariesError} onRetry={() => void summariesQuery.refetch()} />
      ) : null}
      {summariesQuery.isSuccess && deliveries.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">{t.noDeliveries}</p>
      ) : null}
      {deliveries.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <DeliveryList
            deliveries={deliveries}
            selectedDeliveryId={selectedDeliveryId}
            onSelect={setSelectedDeliveryId}
          />
          <section className="min-w-0">
            {!selectedDeliveryId ? (
              <p className="text-sm text-gray-500">{t.deliverySelectPrompt}</p>
            ) : detailQuery.isPending ? (
              <LoadingView />
            ) : detailQuery.isError ? (
              <ErrorView message={detailError} onRetry={() => void detailQuery.refetch()} />
            ) : detailQuery.data ? (
              <DeliveryDetailPanel
                delivery={detailQuery.data}
                tracking={trackingQuery.data ?? null}
                trackingError={trackingQuery.isError ? t.deliveryTrackingLoadError : null}
              />
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function DeliveryList({
  deliveries,
  selectedDeliveryId,
  onSelect,
}: {
  deliveries: DeliverySummary[];
  selectedDeliveryId: string | null;
  onSelect: (deliveryId: string) => void;
}) {
  const countryCode = useCountryCode();
  const t = useTranslations();

  return (
    <div className="space-y-2">
      {deliveries.map((delivery) => {
        const orderTotal = delivery.orders[0]?.totalPrice ?? null;
        const isSelected = delivery.deliveryId === selectedDeliveryId;
        return (
          <button
            key={delivery.deliveryId}
            type="button"
            onClick={() => onSelect(delivery.deliveryId)}
            className={`border-card-border w-full rounded-lg border bg-white p-4 text-left transition-colors ${
              isSelected ? "border-picnic-red ring-picnic-red/20 ring-2" : "hover:border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {formatWindow(delivery.slot?.windowStart, delivery.slot?.windowEnd, countryCode)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {t.deliveryStatus}: {delivery.status ?? "-"}
                </p>
              </div>
              {orderTotal !== null ? (
                <span className="text-sm font-semibold text-gray-900">
                  {formatPrice(orderTotal)}
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DeliveryDetailPanel({
  delivery,
  tracking,
  trackingError,
}: {
  delivery: DeliveryDetail;
  tracking: DeliveryTrackingApiResponse | null;
  trackingError: string | null;
}) {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const order = delivery.orders[0] ?? null;
  const [orderStatusRequested, setOrderStatusRequested] = useState(false);

  useEffect(() => {
    setOrderStatusRequested(false);
  }, [delivery.deliveryId]);

  const orderStatusQuery = useQuery({
    queryKey: order?.id
      ? queryKeys.deliveryOrderStatus(order.id, countryCode)
      : ["delivery-order-status", "none", countryCode],
    queryFn: () => fetchJson<DeliveryOrderStatusApiResponse>(`/api/orders/${order?.id}/status`),
    enabled: Boolean(order?.id && orderStatusRequested),
    staleTime: queryStaleTime.deliveryOrderStatus,
    retry: false,
  });

  function invalidateDeliveryData() {
    void queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.deliveryDetail(delivery.deliveryId, countryCode),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart() });
  }

  const cancelDeliveryMutation = useMutation({
    mutationFn: () =>
      fetchJson<DeliveryActionApiResponse>(`/api/deliveries/${delivery.deliveryId}/cancel`, {
        method: "POST",
      }),
    onSuccess: invalidateDeliveryData,
  });

  const invoiceEmailMutation = useMutation({
    mutationFn: () =>
      fetchJson<DeliveryActionApiResponse>(`/api/deliveries/${delivery.deliveryId}/invoice-email`, {
        method: "POST",
      }),
  });

  const ratingMutation = useMutation({
    mutationFn: (rating: number) =>
      fetchJson<DeliveryActionApiResponse>(`/api/deliveries/${delivery.deliveryId}/rating`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      }),
    onSuccess: invalidateDeliveryData,
  });

  const ratingForm = useForm({
    defaultValues: {
      rating: "10",
    },
    onSubmit: async ({ value }) => {
      ratingMutation.mutate(Number(value.rating));
    },
  });

  useEffect(() => {
    cancelDeliveryMutation.reset();
    invoiceEmailMutation.reset();
    ratingMutation.reset();
  }, [delivery.deliveryId]);

  const canCancelDelivery = delivery.status === "CURRENT" && order?.cancellable === true;
  const canSendInvoiceEmail = delivery.status === "COMPLETED";
  const canRateDelivery = delivery.status === "COMPLETED";

  function handleCancelDelivery() {
    if (!window.confirm(t.cancelDeliveryConfirm)) return;
    cancelDeliveryMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <section className="border-card-border rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {formatWindow(delivery.slot?.windowStart, delivery.slot?.windowEnd, countryCode)}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t.deliveryStatus}: {delivery.status ?? "-"}
            </p>
          </div>
          {order?.checkoutTotalPrice !== null && order?.checkoutTotalPrice !== undefined ? (
            <span className="text-lg font-bold text-gray-900">
              {formatPrice(order.checkoutTotalPrice)}
            </span>
          ) : null}
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <InfoItem label={t.deliveryOrder} value={order?.id ?? "-"} />
          <InfoItem
            label={t.deliveryCreated}
            value={formatDateTime(delivery.creationTime, countryCode)}
          />
          <InfoItem
            label={t.deliveryWindow}
            value={formatWindow(delivery.slot?.windowStart, delivery.slot?.windowEnd, countryCode)}
          />
          <InfoItem
            label={t.deliveryEta}
            value={formatWindow(delivery.eta?.start, delivery.eta?.end, countryCode)}
          />
          <InfoItem label={t.deliverySavings} value={formatNullablePrice(order?.totalSavings)} />
          <InfoItem label={t.deliveryDeposit} value={formatNullablePrice(order?.totalDeposit)} />
          <InfoItem
            label={t.deliveryPayment}
            value={[order?.paymentType, order?.redactedIban].filter(Boolean).join(" ") || "-"}
          />
        </dl>
      </section>

      <section className="border-card-border rounded-lg border bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">{t.deliveryActions}</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {order?.id ? (
            <button
              type="button"
              onClick={() => {
                setOrderStatusRequested(true);
                void orderStatusQuery.refetch();
              }}
              disabled={orderStatusQuery.isFetching}
              className="border-card-border hover:text-foreground rounded-full border px-4 py-2 text-sm font-semibold text-gray-600 transition-colors disabled:cursor-wait disabled:opacity-60"
            >
              {orderStatusQuery.isFetching
                ? t.deliveryOrderStatusLoading
                : t.deliveryOrderStatusRefresh}
            </button>
          ) : null}
          {canCancelDelivery ? (
            <button
              type="button"
              onClick={handleCancelDelivery}
              disabled={cancelDeliveryMutation.isPending}
              className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
            >
              {cancelDeliveryMutation.isPending ? t.cancellingDelivery : t.cancelDelivery}
            </button>
          ) : null}
          {canSendInvoiceEmail ? (
            <button
              type="button"
              onClick={() => invoiceEmailMutation.mutate()}
              disabled={invoiceEmailMutation.isPending}
              className="border-card-border hover:text-foreground rounded-full border px-4 py-2 text-sm font-semibold text-gray-600 transition-colors disabled:cursor-wait disabled:opacity-60"
            >
              {invoiceEmailMutation.isPending ? t.sendingInvoiceEmail : t.sendInvoiceEmail}
            </button>
          ) : null}
        </div>

        {canRateDelivery ? (
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void ratingForm.handleSubmit();
            }}
          >
            <ratingForm.Field name="rating">
              {(field) => (
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  {t.deliveryRating}
                  <select
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="border-input-border focus:border-input-focus focus:ring-input-focus/20 rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:outline-none"
                  >
                    {Array.from({ length: 11 }, (_, score) => (
                      <option key={score} value={score}>
                        {score}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </ratingForm.Field>
            <button
              type="submit"
              disabled={ratingMutation.isPending}
              className="bg-picnic-red hover:bg-picnic-red-dark rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-wait disabled:opacity-60"
            >
              {ratingMutation.isPending ? t.submittingDeliveryRating : t.submitDeliveryRating}
            </button>
          </form>
        ) : null}

        <DeliveryActionFeedback
          error={cancelDeliveryMutation.error}
          success={cancelDeliveryMutation.isSuccess ? t.cancelDeliverySuccess : null}
          fallbackError={t.cancelDeliveryError}
        />
        <DeliveryActionFeedback
          error={invoiceEmailMutation.error}
          success={invoiceEmailMutation.isSuccess ? t.invoiceEmailSent : null}
          fallbackError={t.invoiceEmailError}
        />
        <DeliveryActionFeedback
          error={ratingMutation.error}
          success={ratingMutation.isSuccess ? t.deliveryRatingSaved : null}
          fallbackError={t.deliveryRatingError}
        />

        {orderStatusQuery.isError ? (
          <p className="mt-3 text-sm text-red-600">
            {orderStatusQuery.error instanceof ApiClientError
              ? orderStatusQuery.error.message
              : t.deliveryOrderStatusError}
          </p>
        ) : null}
        {orderStatusQuery.data ? (
          <div className="mt-4">
            <RawPayload title={t.deliveryOrderStatus} value={orderStatusQuery.data.status} />
          </div>
        ) : null}
      </section>

      <section className="border-card-border rounded-lg border bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">{t.deliveryItems}</h2>
        {delivery.lineItems.length ? (
          <div className="mt-3 divide-y divide-gray-100">
            {delivery.lineItems.map((item) => (
              <div key={item.id ?? item.productId ?? item.name} className="flex gap-3 py-3">
                <img
                  src={
                    item.imageId
                      ? buildImageUrl(item.imageId, countryCode, "small")
                      : "/placeholder-product.svg"
                  }
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md object-contain"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.quantity} x {item.unitQuantity ?? "-"}
                  </p>
                </div>
                {item.displayPrice !== null ? (
                  <span className="text-sm font-semibold text-gray-900">
                    {formatPrice(item.displayPrice)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">-</p>
        )}
      </section>

      {delivery.status === "CURRENT" ? (
        <section className="border-card-border rounded-lg border bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">{t.deliveryTracking}</h2>
          {trackingError ? <p className="mt-2 text-sm text-red-600">{trackingError}</p> : null}
          {tracking ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <RawPayload title={t.deliveryScenario} value={tracking.scenario} />
              <RawPayload title={t.deliveryPosition} value={tracking.position} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">-</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function DeliveryActionFeedback({
  error,
  success,
  fallbackError,
}: {
  error: Error | null;
  success: string | null;
  fallbackError: string;
}) {
  if (error) {
    return (
      <p className="mt-3 text-sm text-red-600">
        {error instanceof ApiClientError ? error.message : fallbackError}
      </p>
    );
  }
  if (success) {
    return <p className="mt-3 text-sm text-green-700">{success}</p>;
  }
  return null;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function RawPayload({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700">
        {value === null || value === undefined ? "-" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatDateTime(value: string | null | undefined, countryCode: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeForCountry(countryCode), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  countryCode: string
): string {
  if (!start || !end) return "-";

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} - ${end}`;
  }

  const locale = localeForCountry(countryCode);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(startDate);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day}, ${time.format(startDate)} - ${time.format(endDate)}`;
}

function formatNullablePrice(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "-" : formatPrice(cents);
}

function localeForCountry(countryCode: string): string {
  if (countryCode === "DE") return "de-DE";
  if (countryCode === "FR") return "fr-FR";
  return "nl-NL";
}
