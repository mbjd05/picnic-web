import { useState } from "react";

import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/badge";
import { PriceDisplay } from "@/components/price-display";
import { TrashIcon } from "@/components/trash-icon";
import { buildImageUrl } from "@/lib/image-url";
import type { CartItem } from "@/lib/cart-types";

import { useCountryCode, useTranslations } from "../../country-context";
import { useWheelQuantityAdjust } from "../../lib/use-wheel-quantity-adjust";

export function CartItemCard({
  item,
  onIncrement,
  onDecrement,
  onRemoveAll,
}: {
  item: CartItem;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onRemoveAll?: () => void;
}) {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const [imgError, setImgError] = useState(false);
  const imageSrc =
    imgError || !item.imageId
      ? "/placeholder-product.svg"
      : buildImageUrl(item.imageId, countryCode);

  return (
    <div className={`border-card-border border-b py-2${item.isUnavailable ? "bg-gray-50" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/product/$id"
          params={{ id: item.productId }}
          className={`flex min-w-0 flex-1 gap-3 transition-colors hover:bg-gray-50${
            item.isUnavailable ? "opacity-60" : ""
          }`}
        >
          <div className="relative h-14 w-14 shrink-0 md:h-16 md:w-16">
            <img
              src={imageSrc}
              alt={item.name}
              loading="lazy"
              className="h-full w-full rounded-md object-contain"
              onError={() => setImgError(true)}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <div>
              <p className="text-foreground line-clamp-2 text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-gray-500">{item.unitQuantity}</p>
            </div>
            {item.badges.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {item.badges.map((badge, index) => (
                  <Badge key={`${badge.variant}-${index}`} badge={badge} />
                ))}
              </div>
            ) : null}
          </div>
        </Link>

        <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
          {!item.isUnavailable && onIncrement && onDecrement && onRemoveAll ? (
            <>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onRemoveAll}
                  className="text-text-muted hover:text-picnic-red flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-red-50 active:opacity-70"
                  aria-label={`${t.removeItemAriaLabel}: ${item.name}`}
                  title={t.removeItemAriaLabel}
                >
                  <TrashIcon />
                </button>
                <QuantityStepper
                  quantity={item.quantity}
                  maxCount={item.maxCount}
                  onIncrement={onIncrement}
                  onDecrement={onDecrement}
                />
              </div>
              <PriceDisplay displayPrice={item.displayPrice} originalPrice={item.originalPrice} />
            </>
          ) : (
            <>
              <span className="text-text-muted text-xs font-semibold">{item.quantity}x</span>
              <PriceDisplay displayPrice={item.displayPrice} originalPrice={item.originalPrice} />
            </>
          )}
        </div>
      </div>
      {item.isUnavailable && item.unavailableExplanation ? (
        <div className="mt-2">
          <p className="text-picnic-orange text-sm">{item.unavailableExplanation}</p>
        </div>
      ) : null}
    </div>
  );
}

function QuantityStepper({
  quantity,
  maxCount,
  onIncrement,
  onDecrement,
}: {
  quantity: number;
  maxCount: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const t = useTranslations();
  const isAtMax = quantity >= maxCount;
  const isAtMin = quantity <= 1;
  const wheelAdjustRef = useWheelQuantityAdjust({
    canIncrement: !isAtMax,
    canDecrement: !isAtMin,
    onIncrement,
    onDecrement,
  });
  return (
    <div
      ref={wheelAdjustRef}
      className="quantity-control-surface flex items-center gap-0 rounded-full px-0.5 py-0.5"
    >
      <button
        type="button"
        onClick={onDecrement}
        disabled={isAtMin}
        className={`flex h-8 w-8 items-center justify-center text-base font-semibold transition-opacity ${
          isAtMin ? "cursor-not-allowed text-gray-300" : "text-foreground active:opacity-60"
        }`}
        aria-label={t.removeOneAriaLabel}
      >
        −
      </button>
      <span className="text-foreground min-w-[1.5rem] text-center text-sm font-bold">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={isAtMax}
        className={`flex h-8 w-8 items-center justify-center text-base font-semibold transition-opacity ${
          isAtMax ? "cursor-not-allowed text-gray-300" : "text-foreground active:opacity-60"
        }`}
        aria-label={t.addOneAriaLabel}
      >
        +
      </button>
    </div>
  );
}
