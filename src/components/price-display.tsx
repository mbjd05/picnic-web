import { formatPrice } from "@/lib/format/price";

type PriceDisplayProps = {
  /** Current price in cents. */
  displayPrice: number;
  /** Original price in cents (before discount), or null. */
  originalPrice: number | null;
  /** Optional API-provided color for the current price. */
  displayPriceColor?: string | null;
};

export function PriceDisplay({
  displayPrice,
  originalPrice,
  displayPriceColor,
}: PriceDisplayProps) {
  const hasDiscount = originalPrice !== null && originalPrice > displayPrice;
  const priceClass = hasDiscount ? "text-price-discount" : "text-price";

  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={`text-lg font-bold ${displayPriceColor ? "" : priceClass}`}
        style={displayPriceColor ? { color: displayPriceColor } : undefined}
      >
        {formatPrice(displayPrice)}
      </span>
      {hasDiscount && (
        <span className="text-price-original text-sm line-through">
          {formatPrice(originalPrice)}
        </span>
      )}
    </div>
  );
}
