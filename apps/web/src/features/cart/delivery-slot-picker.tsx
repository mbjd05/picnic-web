import { useCallback, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  DeliverySlotData,
  DeliverySlotPickerData,
  SlotDayGroup,
} from "@/lib/delivery-slot-types";
import { formatTime } from "@/lib/format-delivery-window";
import type { CartData } from "@/lib/types";

import { useTranslations } from "../../country-context";
import { fetchJson } from "../../lib/api-client";
import { queryKeys, queryStaleTime } from "../../lib/query-config";

export function DeliverySlotPicker({
  onClose,
  onSlotSelected,
}: {
  onClose: () => void;
  onSlotSelected: (updatedCart: CartData) => void;
}) {
  const queryClient = useQueryClient();
  const [dayIndex, setDayIndex] = useState(0);
  const [selectingSlotId, setSelectingSlotId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | undefined>(undefined);
  const slotsQuery = useQuery({
    queryKey: queryKeys.deliverySlots(),
    queryFn: () => fetchJson<DeliverySlotPickerData>("/api/cart/delivery-slots"),
    staleTime: queryStaleTime.deliverySlots,
  });

  const loadSlots = useCallback(() => {
    setSelectionError(undefined);
    void slotsQuery.refetch();
  }, [slotsQuery]);

  const handleSelectSlot = useCallback(
    (slotId: string) => {
      setSelectingSlotId(slotId);
      setSelectionError(undefined);
      fetchJson<CartData>("/api/cart/delivery-slots", {
        method: "POST",
        body: JSON.stringify({ slotId }),
      })
        .then((cart) => {
          queryClient.setQueryData(queryKeys.cart(), cart);
          void queryClient.invalidateQueries({ queryKey: queryKeys.deliverySlots() });
          onSlotSelected(cart);
        })
        .catch((error) => {
          setSelectionError(
            error instanceof Error ? error.message : "Kan bezorgmoment niet kiezen."
          );
        })
        .finally(() => {
          setSelectingSlotId(null);
        });
    },
    [onSlotSelected, queryClient]
  );

  const handleDayChange = useCallback((dayIndex: number) => {
    setDayIndex(dayIndex);
    setSelectionError(undefined);
  }, []);

  const slotErrorMessage =
    slotsQuery.error instanceof Error ? slotsQuery.error.message : "Kan bezorgmomenten niet laden.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[min(600px,90vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <PickerHeader onClose={onClose} />
        {slotsQuery.isPending ? <PickerLoading /> : null}
        {slotsQuery.isError ? <PickerError message={slotErrorMessage} onRetry={loadSlots} /> : null}
        {slotsQuery.data ? (
          <SlotListBody
            data={slotsQuery.data}
            dayIndex={Math.min(dayIndex, Math.max(0, slotsQuery.data.dayGroups.length - 1))}
            selectingSlotId={selectingSlotId}
            selectionError={selectionError}
            onDayChange={handleDayChange}
            onSelectSlot={handleSelectSlot}
          />
        ) : null}
      </div>
    </div>
  );
}

function PickerHeader({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  return (
    <div className="border-b border-gray-200 px-4 pt-4 pb-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-foreground text-lg font-bold">{t.pickerTitle}</h2>
          <p className="text-sm text-green-700">{t.freeDeliveryLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
          aria-label={t.closeAriaLabel}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function PickerLoading() {
  return (
    <div className="flex min-h-[200px] flex-1 items-center justify-center">
      <div className="border-t-picnic-red h-8 w-8 animate-spin rounded-full border-4 border-gray-200" />
    </div>
  );
}

function PickerError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-gray-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-picnic-red rounded-lg px-4 py-2 text-sm font-medium text-white"
      >
        {t.retryLabel}
      </button>
    </div>
  );
}

function SlotListBody({
  data,
  dayIndex,
  selectingSlotId,
  selectionError,
  onDayChange,
  onSelectSlot,
}: {
  data: DeliverySlotPickerData;
  dayIndex: number;
  selectingSlotId: string | null;
  selectionError?: string;
  onDayChange: (index: number) => void;
  onSelectSlot: (slotId: string) => void;
}) {
  const t = useTranslations();
  if (data.dayGroups.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center px-6 text-center">
        <p className="text-sm text-gray-500">{t.noSlotsLabel}</p>
      </div>
    );
  }
  const currentDay = data.dayGroups[dayIndex];
  const selectedOnThisDay = data.selectedSlot
    ? findSlotInDay(currentDay, data.selectedSlot.slotId)
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DayTabs groups={data.dayGroups} activeIndex={dayIndex} onChange={onDayChange} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {selectionError ? (
          <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {selectionError}
          </div>
        ) : null}
        {selectedOnThisDay ? (
          <SelectedDayView
            selectedSlot={selectedOnThisDay}
            otherSlots={getAllSlots(currentDay).filter(
              (slot) => slot.slotId !== selectedOnThisDay.slotId
            )}
            selectingSlotId={selectingSlotId}
            onSelectSlot={onSelectSlot}
          />
        ) : (
          <DefaultDayView
            day={currentDay}
            selectingSlotId={selectingSlotId}
            onSelectSlot={onSelectSlot}
          />
        )}
      </div>
    </div>
  );
}

function DayTabs({
  groups,
  activeIndex,
  onChange,
}: {
  groups: SlotDayGroup[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-4 py-2">
      {groups.map((group, index) => (
        <button
          key={group.date}
          type="button"
          onClick={() => onChange(index)}
          className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 text-xs transition-colors ${
            index === activeIndex
              ? "bg-picnic-red text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <span className="font-medium">{group.dayLabel}</span>
          <span className="opacity-75">{group.dateLabel}</span>
        </button>
      ))}
    </div>
  );
}

function SelectedDayView({
  selectedSlot,
  otherSlots,
  selectingSlotId,
  onSelectSlot,
}: {
  selectedSlot: DeliverySlotData;
  otherSlots: DeliverySlotData[];
  selectingSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  const t = useTranslations();
  return (
    <>
      <SectionHeader text={t.selectedSectionLabel} />
      <SlotRow
        slot={selectedSlot}
        isSelecting={selectingSlotId === selectedSlot.slotId}
        isDisabled={selectingSlotId !== null}
        isCurrentlySelected
        onSelect={onSelectSlot}
      />
      {otherSlots.length > 0 ? (
        <>
          <SectionHeader text={t.otherMomentLabel} />
          {otherSlots.map((slot) => (
            <SlotRow
              key={slot.slotId}
              slot={slot}
              isSelecting={selectingSlotId === slot.slotId}
              isDisabled={selectingSlotId !== null}
              isCurrentlySelected={false}
              onSelect={onSelectSlot}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function DefaultDayView({
  day,
  selectingSlotId,
  onSelectSlot,
}: {
  day: SlotDayGroup;
  selectingSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  const t = useTranslations();
  return (
    <>
      {day.greenSlots.length > 0 ? (
        <>
          <SectionHeader text={t.greenChoiceLabel} icon="leaf" />
          {day.greenSlots.map((slot) => (
            <SlotRow
              key={slot.slotId}
              slot={slot}
              isSelecting={selectingSlotId === slot.slotId}
              isDisabled={selectingSlotId !== null}
              isCurrentlySelected={false}
              onSelect={onSelectSlot}
            />
          ))}
        </>
      ) : null}
      {day.regularSlots.length > 0 ? (
        <>
          <SectionHeader text={t.otherMomentLabel} />
          {day.regularSlots.map((slot) => (
            <SlotRow
              key={slot.slotId}
              slot={slot}
              isSelecting={selectingSlotId === slot.slotId}
              isDisabled={selectingSlotId !== null}
              isCurrentlySelected={false}
              onSelect={onSelectSlot}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function SectionHeader({ text, icon }: { text: string; icon?: "leaf" }) {
  return (
    <div className="mt-4 mb-2 flex items-center gap-1.5">
      {icon === "leaf" ? <LeafIcon /> : null}
      <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{text}</span>
    </div>
  );
}

function SlotRow({
  slot,
  isSelecting,
  isDisabled,
  isCurrentlySelected,
  onSelect,
}: {
  slot: DeliverySlotData;
  isSelecting: boolean;
  isDisabled: boolean;
  isCurrentlySelected: boolean;
  onSelect: (slotId: string) => void;
}) {
  const startTime = formatTime(new Date(slot.windowStart));
  const endTime = formatTime(new Date(slot.windowEnd));
  return (
    <button
      type="button"
      onClick={() => onSelect(slot.slotId)}
      disabled={isDisabled || !slot.isAvailable}
      className={`mb-1.5 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
        isCurrentlySelected
          ? "border-green-500 bg-green-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      } ${isDisabled || !slot.isAvailable ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        {slot.isGreenChoice ? <LeafIcon /> : null}
        <span className="text-foreground text-sm font-medium">
          {startTime} - {endTime}
        </span>
      </div>
      <div className="flex items-center">
        {isSelecting ? (
          <div className="border-t-picnic-red h-4 w-4 animate-spin rounded-full border-2 border-gray-300" />
        ) : null}
        {isCurrentlySelected && !isSelecting ? <CheckIcon /> : null}
      </div>
    </button>
  );
}

function findSlotInDay(day: SlotDayGroup, slotId: string): DeliverySlotData | null {
  return getAllSlots(day).find((slot) => slot.slotId === slotId) ?? null;
}

function getAllSlots(day: SlotDayGroup): DeliverySlotData[] {
  return [...day.greenSlots, ...day.regularSlots];
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 3s-1 5-5 7C4 12 3 13 3 13s0-5 4-7c1.5-1 3.5-2 6-3Z"
        fill="#22c55e"
        stroke="#16a34a"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#22c55e" />
      <path
        d="M6 10l3 3 5-6"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
