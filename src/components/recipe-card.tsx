"use client";

import { useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { useCountryCode, useTranslations } from "@/contexts/country-context";
import { buildRecipeImageUrl } from "@/lib/image-url";
import type { RecipeItem } from "@/lib/types";

const PLACEHOLDER = "/placeholder-product.svg";

type RecipeCardProps = {
  recipe: RecipeItem;
  isSaved?: boolean;
  isSaving?: boolean;
  onToggleSaved?: (recipe: RecipeItem) => void;
};

export function RecipeCard({
  recipe,
  isSaved = false,
  isSaving = false,
  onToggleSaved,
}: RecipeCardProps) {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const [imageSrc, setImageSrc] = useState(
    recipe.imageId ? buildRecipeImageUrl(recipe.imageId, countryCode) : PLACEHOLDER
  );

  return (
    <div className="group relative h-full">
      <div className="border-card-border bg-card-bg flex h-full flex-col overflow-hidden rounded-lg border shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative h-40 w-full bg-gray-50">
          <Image
            src={imageSrc}
            alt={recipe.name}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => {
              if (imageSrc !== PLACEHOLDER) setImageSrc(PLACEHOLDER);
            }}
          />
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="text-text-dark line-clamp-2 text-sm leading-snug font-medium">
            {recipe.name}
          </h3>

          {recipe.cookingTimeMinutes !== null && (
            <p className="text-text-muted text-xs">
              {recipe.cookingTimeMinutes} {t.cookingTimeMinutes}
            </p>
          )}
        </div>
      </div>

      <Link href={`/recipe/${recipe.id}`} className="absolute inset-0 z-10 rounded-lg" aria-label={recipe.name} />

      {onToggleSaved && (
        <button
          type="button"
          onClick={() => onToggleSaved(recipe)}
          disabled={isSaving}
          className={`absolute top-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors hover:bg-white active:opacity-70 disabled:opacity-50 ${
            isSaved ? "text-picnic-red" : "text-text-muted"
          }`}
          aria-label={isSaved ? t.unsaveRecipe : t.saveRecipe}
          title={isSaved ? t.unsaveRecipe : t.saveRecipe}
        >
          <BookmarkIcon filled={isSaved} />
        </button>
      )}
    </div>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
      <path
        d="M5.75 3.5h8.5v13l-4.25-2.7-4.25 2.7v-13Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
