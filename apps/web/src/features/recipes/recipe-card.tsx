import { useState } from "react";

import { Link } from "@tanstack/react-router";

import { buildRecipeImageUrl } from "@/lib/media/image-url";
import type { RecipeItem } from "@/types/recipe";

import { useCountryCode, useTranslations } from "../../providers/country-context";
import { BookmarkIcon } from "./recipe-icons";

const PLACEHOLDER = "/placeholder-product.svg";

export function RecipeCard({
  recipe,
  isSaved,
  isSaving,
  onToggleSaved,
}: {
  recipe: RecipeItem;
  isSaved: boolean;
  isSaving: boolean;
  onToggleSaved: (recipe: RecipeItem) => void;
}) {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const [imageSrc, setImageSrc] = useState(
    recipe.imageId ? buildRecipeImageUrl(recipe.imageId, countryCode) : PLACEHOLDER
  );
  return (
    <div className="group relative h-full">
      <div className="border-card-border bg-card-bg flex h-full flex-col overflow-hidden rounded-lg border shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative h-40 w-full bg-gray-50">
          <img
            src={imageSrc}
            alt={recipe.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageSrc(PLACEHOLDER)}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="text-text-dark line-clamp-2 text-sm leading-snug font-medium">
            {recipe.name}
          </h3>
          {recipe.cookingTimeMinutes !== null ? (
            <p className="text-text-muted text-xs">
              {recipe.cookingTimeMinutes} {t.cookingTimeMinutes}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        to="/recipe/$id"
        params={{ id: recipe.id }}
        className="absolute inset-0 z-10 rounded-lg"
        aria-label={recipe.name}
      />
      <button
        type="button"
        onClick={() => onToggleSaved(recipe)}
        disabled={isSaving}
        className={`absolute top-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors hover:bg-white active:opacity-70 disabled:opacity-50 ${isSaved ? "text-picnic-red" : "text-text-muted"}`}
        aria-label={isSaved ? t.unsaveRecipe : t.saveRecipe}
      >
        <BookmarkIcon filled={isSaved} />
      </button>
    </div>
  );
}
