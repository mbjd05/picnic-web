import { renderMarkdownBold } from "@/lib/format/render-markdown-bold";
import type { RecipeDetail } from "@/types/recipe";

import { useTranslations } from "../../app/providers/country-context";

export function RecipeStepsSection({ recipe }: { recipe: RecipeDetail }) {
  const t = useTranslations();
  if (recipe.steps.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="text-foreground mb-3 text-base font-semibold">{t.recipeSteps}</h2>
      {recipe.stepsPortionWarning ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700">
          {recipe.stepsPortionWarning}
        </p>
      ) : null}
      <ol className="space-y-4">
        {recipe.steps.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span className="bg-picnic-red mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
              {index + 1}
            </span>
            <p className="text-text-dark text-sm leading-relaxed">{renderMarkdownBold(step)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
