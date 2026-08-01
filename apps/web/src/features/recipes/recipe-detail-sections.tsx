import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { NutritionTable } from "@/components/nutrition-table";
import { formatEuroPrice } from "@/lib/format/price";
import { buildImageUrl, buildRecipeImageUrl } from "@/lib/media/image-url";
import { getRecipeIngredientCount } from "@/lib/recipes/quantity";
import type { AllergenInfo } from "@/types/product";
import type { CountryCode } from "@/types/locale";
import type { RecipeDetail, RecipeIngredient } from "@/types/recipe";

import { useCountryCode, useTranslations } from "../../app/providers/country-context";

const PLACEHOLDER = "/placeholder-product.svg";

export function RecipeHeroImage({
  imageId,
  countryCode,
  alt,
}: {
  imageId: string;
  countryCode: CountryCode;
  alt: string;
}) {
  const [show, setShow] = useState(true);
  if (!show) return <div className="aspect-video w-full bg-gray-100" />;
  return (
    <img
      src={buildRecipeImageUrl(imageId, countryCode)}
      alt={alt}
      className="aspect-video w-full object-cover"
      onError={() => setShow(false)}
    />
  );
}

export function RecipeNutritionSection({ recipe }: { recipe: RecipeDetail }) {
  const t = useTranslations();
  if (!recipe.recipeNutritionRows.length) return null;
  return (
    <section className="mb-6">
      <h2 className="text-foreground mb-2 text-base font-semibold">{t.recipeNutrition}</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <NutritionTable rows={recipe.recipeNutritionRows} />
      </div>
    </section>
  );
}

export function RecipeAllergenSection({ recipe }: { recipe: RecipeDetail }) {
  const t = useTranslations();
  if (!recipe.allergens.confirmed.length && !recipe.allergens.mayContain.length) return null;
  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <RecipeAllergenBadges
        allergens={recipe.allergens}
        confirmedLabel={t.recipeAllergens}
        mayContainLabel={t.recipeMayContain}
      />
    </section>
  );
}

function RecipeAllergenBadges({
  allergens,
  confirmedLabel,
  mayContainLabel,
}: {
  allergens: AllergenInfo;
  confirmedLabel: string;
  mayContainLabel: string;
}) {
  const sections = [
    { label: confirmedLabel, items: allergens.confirmed },
    { label: mayContainLabel, items: allergens.mayContain },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.label}>
          <h2 className="text-foreground mb-2 text-base font-semibold">{section.label}</h2>
          <div className="flex flex-wrap gap-2">
            {section.items.map((allergen) => (
              <span
                key={`${section.label}-${allergen.text}`}
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: allergen.backgroundColor, color: allergen.textColor }}
              >
                {allergen.text}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function IngredientSection({
  title,
  ingredients,
  portions,
  basePortion,
  checkedIds,
  setCheckedIds,
  muted = false,
}: {
  title: string;
  ingredients: RecipeIngredient[];
  portions: number;
  basePortion: number;
  checkedIds: Set<string>;
  setCheckedIds: Dispatch<SetStateAction<Set<string>>>;
  muted?: boolean;
}) {
  if (!ingredients.length) return null;
  return (
    <section className="mb-6">
      <h2
        className={`${muted ? "text-text-muted text-sm" : "text-foreground text-base"} mb-2 font-semibold`}
      >
        {title}
      </h2>
      <div
        className={`divide-y divide-gray-100 rounded-xl border ${muted ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"} px-3 sm:px-4`}
      >
        {ingredients.map((ingredient) => (
          <RecipeIngredientRow
            key={ingredient.id}
            ingredient={ingredient}
            qty={getRecipeIngredientCount(ingredient, portions, basePortion)}
            portions={portions}
            basePortion={basePortion}
            checked={checkedIds.has(ingredient.id)}
            onToggle={() =>
              setCheckedIds((current) => {
                const next = new Set(current);
                if (next.has(ingredient.id)) next.delete(ingredient.id);
                else next.add(ingredient.id);
                return next;
              })
            }
          />
        ))}
      </div>
    </section>
  );
}

function RecipeIngredientRow({
  ingredient,
  qty,
  portions,
  basePortion,
  checked,
  onToggle,
}: {
  ingredient: RecipeIngredient;
  qty: number;
  portions: number;
  basePortion: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const countryCode = useCountryCode();
  const [imgSrc, setImgSrc] = useState(
    ingredient.imageId ? buildImageUrl(ingredient.imageId, countryCode) : PLACEHOLDER
  );
  const scaledNeeded = ingredient.recipeQuantityText
    ? scaleNeededText(ingredient.recipeQuantityText, portions, basePortion)
    : null;
  const packageLabel =
    qty > 1
      ? `${qty} × ${ingredient.recipePackageSize ?? ingredient.unitQuantity}`
      : (ingredient.recipePackageSize ?? ingredient.unitQuantity);
  const title = scaledNeeded
    ? `${scaledNeeded.replace(/^\((.*)\)$/, "$1").replace(/\s+(nodig|benötigt|benodigd|required)$/i, "")} ${ingredient.name}`
    : ingredient.name;
  const bundleTier = ingredient.priceRanges?.filter((tier) => tier.quantity <= qty).at(-1);
  const totalPrice = (bundleTier ? bundleTier.pricePerUnit : ingredient.displayPrice) * qty;
  const rawStrike = bundleTier
    ? ingredient.displayPrice * qty
    : ingredient.originalPrice !== null
      ? ingredient.originalPrice * qty
      : null;
  const strike = rawStrike !== null && rawStrike > totalPrice ? rawStrike : null;
  return (
    <div
      className={`flex items-center gap-2 py-3 sm:gap-3 ${strike ? "-mx-3 rounded-lg bg-yellow-50 px-3 sm:-mx-4 sm:px-4" : ""}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${checked ? "border-picnic-red bg-picnic-red" : "border-gray-300 bg-white"}`}
      >
        {checked ? <span className="text-xs text-white">✓</span> : null}
      </button>
      <img
        src={imgSrc}
        alt={ingredient.name}
        loading="lazy"
        className={`h-12 w-12 shrink-0 rounded-lg bg-gray-50 object-contain p-1 ${checked ? "" : "opacity-40"}`}
        onError={() => setImgSrc(PLACEHOLDER)}
      />
      <div className={`min-w-0 flex-1 ${checked ? "" : "opacity-40"}`}>
        <p className="text-text-dark line-clamp-3 text-sm font-medium break-words sm:line-clamp-2">
          {title}
        </p>
        <p className="text-text-muted text-xs">{packageLabel}</p>
      </div>
      <div className={`min-w-[3.5rem] shrink-0 text-right ${checked ? "" : "opacity-40"}`}>
        <p className={`text-sm font-medium ${strike ? "text-amber-600" : "text-text-dark"}`}>
          {formatEuroPrice(totalPrice)}
        </p>
        {strike ? (
          <p className="text-xs text-gray-400 line-through">{formatEuroPrice(strike)}</p>
        ) : null}
      </div>
    </div>
  );
}

function scaleNeededText(text: string, portions: number, basePortion: number): string {
  if (basePortion === 0) return text;
  const match = /^\((\d+(?:[.,]\d+)?)\s+(.+)\)$/.exec(text);
  if (!match) return text;
  const scaled = (parseFloat(match[1].replace(",", ".")) * portions) / basePortion;
  return `(${Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1).replace(".", ",")} ${match[2]})`;
}
