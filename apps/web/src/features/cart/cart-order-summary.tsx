import { formatPrice } from "@/lib/format/price";
import type { DepositEntry, FeeEntry } from "@/lib/types/cart";

import { useTranslations } from "../../country-context";

export function CartOrderSummary({
  totalPrice,
  totalCount,
  totalDiscount,
  depositBreakdown,
  membershipSavings,
  fees,
  minimumOrderValue,
  isUpdating,
}: {
  totalPrice: number;
  totalCount: number;
  totalDiscount: number;
  depositBreakdown: DepositEntry[];
  membershipSavings: number;
  fees: FeeEntry[];
  minimumOrderValue: number | null;
  isUpdating: boolean;
}) {
  const t = useTranslations();
  if (totalCount === 0) return null;

  function depositLabel(type: string): string {
    switch (type.toUpperCase()) {
      case "BAG":
        return t.depositBag;
      case "BOTTLE":
        return t.depositBottle;
      default:
        return t.depositGeneric;
    }
  }

  return (
    <div
      className={`border-card-border bg-card-bg rounded-xl border p-4 transition-opacity ${
        isUpdating ? "opacity-70" : "opacity-100"
      }`}
      aria-busy={isUpdating}
      aria-live="polite"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-foreground text-base font-semibold">{t.orderSummaryTitle}</h2>
        {isUpdating ? (
          <span className="text-xs text-gray-500">{t.orderSummaryUpdating}</span>
        ) : null}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-700">
          <span>
            {t.itemsLabel} ({totalCount})
          </span>
        </div>
        {totalDiscount > 0 ? (
          <SummaryDiscountRow label={t.discountLabel} amount={totalDiscount} />
        ) : null}
        {depositBreakdown
          .filter((entry) => entry.total > 0)
          .map((entry) => (
            <div key={entry.type} className="flex justify-between text-gray-700">
              <span>{depositLabel(entry.type)}</span>
              <span>{formatPrice(entry.total)}</span>
            </div>
          ))}
        {membershipSavings > 0 ? (
          <SummaryDiscountRow label={t.membershipSavingsLabel} amount={membershipSavings} />
        ) : null}
        {fees.map((fee) => (
          <div
            key={fee.type}
            className={`flex justify-between ${fee.amount < 0 ? "text-picnic-green" : "text-gray-700"}`}
          >
            <span>{fee.name}</span>
            <span>
              {fee.amount < 0 ? `−${formatPrice(Math.abs(fee.amount))}` : formatPrice(fee.amount)}
            </span>
          </div>
        ))}
        {minimumOrderValue !== null && minimumOrderValue > 0 ? (
          <div className="flex justify-between text-gray-700">
            <span>{t.minimumOrderLabel}</span>
            <span className={totalPrice >= minimumOrderValue ? "text-picnic-green" : ""}>
              {totalPrice >= minimumOrderValue ? <span className="mr-1">&#10003;</span> : null}
              {formatPrice(minimumOrderValue)}
            </span>
          </div>
        ) : null}
        <div className="border-card-border text-foreground flex justify-between border-t pt-2 font-bold">
          <span>{t.totalLabel}</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryDiscountRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="text-picnic-green flex justify-between">
      <span>{label}</span>
      <span>−{formatPrice(amount)}</span>
    </div>
  );
}
