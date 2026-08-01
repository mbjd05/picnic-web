import { formatEuroPrice } from "@/lib/format/price";

import { useTranslations } from "../../providers/country-context";

export function RecipeAddToCartPanel({
  portions,
  setPortions,
  pricePerServing,
  totalCents,
  cookingTimeMinutes,
  refreshing,
  showAddButton,
  isAddDisabled,
  buttonLabel,
  isDone,
  onAddToCart,
}: {
  portions: number;
  setPortions: (updater: (portions: number) => number) => void;
  pricePerServing: string | null;
  totalCents: number;
  cookingTimeMinutes: number | null;
  refreshing: boolean;
  showAddButton: boolean;
  isAddDisabled: boolean;
  buttonLabel: string;
  isDone: boolean;
  onAddToCart: () => void;
}) {
  const t = useTranslations();
  return (
    <>
      <div className="text-text-muted mb-6 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <span className="flex items-center gap-2">
          {t.recipePortions}:{" "}
          <button
            type="button"
            onClick={() => setPortions((p) => Math.max(1, p - 1))}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs"
          >
            −
          </button>
          <span className="text-foreground mx-1 font-medium">{portions}</span>
          <button
            type="button"
            onClick={() => setPortions((p) => p + 1)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs"
          >
            +
          </button>
        </span>
        {pricePerServing ? (
          <span className={`leading-relaxed ${refreshing ? "opacity-40" : ""}`}>
            <span className="text-foreground font-medium">{pricePerServing}</span>{" "}
            <span className="text-gray-400">{t.recipePricePerServing}</span>
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="text-foreground font-medium">{formatEuroPrice(totalCents)}</span>{" "}
            <span className="text-gray-400">{t.recipePriceTotal}</span>
            {cookingTimeMinutes !== null ? (
              <>
                <span className="mx-1.5 text-gray-300">·</span>
                <span>
                  {cookingTimeMinutes} {t.cookingTimeMinutes}
                </span>
              </>
            ) : null}
          </span>
        ) : null}
      </div>
      {showAddButton ? (
        <button
          type="button"
          onClick={onAddToCart}
          disabled={isAddDisabled}
          className={`mb-8 w-full rounded-xl px-6 py-3 text-sm font-semibold text-white ${
            isDone
              ? "bg-picnic-green"
              : "bg-picnic-red hover:bg-picnic-red-dark disabled:opacity-60"
          }`}
        >
          {buttonLabel}
        </button>
      ) : null}
    </>
  );
}
