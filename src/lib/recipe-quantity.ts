import type { RecipeIngredient } from "./types/recipe";

type ParsedAmount = {
  value: number;
  unit: "g" | "ml" | "piece";
};

const UNIT_RE = "(kg|g|gram|l|ml|el|tl|stuk|stuks)";

function normalizeUnit(unit: string): { unit: ParsedAmount["unit"]; multiplier: number } | null {
  switch (unit.toLowerCase()) {
    case "kg":
      return { unit: "g", multiplier: 1000 };
    case "g":
    case "gram":
      return { unit: "g", multiplier: 1 };
    case "l":
      return { unit: "ml", multiplier: 1000 };
    case "ml":
      return { unit: "ml", multiplier: 1 };
    case "stuk":
    case "stuks":
      return { unit: "piece", multiplier: 1 };
    default:
      return null;
  }
}

function parseAmount(text: string | null): ParsedAmount | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^\((.*)\)$/, "$1")
    .replace(/\s+(nodig|benötigt|benodigd|required)$/i, "")
    .trim();

  const multiMatch = new RegExp(
    `^(\\d+)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}\\b`,
    "i"
  ).exec(cleaned);
  const singleMatch =
    multiMatch ?? new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}\\b`, "i").exec(cleaned);

  if (!singleMatch) return null;

  const multiplier = multiMatch ? parseInt(singleMatch[1], 10) : 1;
  const amount = parseFloat(singleMatch[multiMatch ? 2 : 1].replace(",", "."));
  const unitText = singleMatch[multiMatch ? 3 : 2];
  const normalized = normalizeUnit(unitText);
  if (!normalized) return null;

  return {
    value: multiplier * amount * normalized.multiplier,
    unit: normalized.unit,
  };
}

export function getRecipeIngredientCount(
  ingredient: RecipeIngredient,
  portions: number,
  basePortions: number
): number {
  const analyticsCount = Math.max(1, Math.ceil((ingredient.quantity * portions) / basePortions));
  const needed = parseAmount(ingredient.recipeQuantityText);
  const packageAmount = parseAmount(ingredient.recipePackageSize ?? ingredient.unitQuantity);

  if (!needed || !packageAmount || needed.unit !== packageAmount.unit || packageAmount.value <= 0) {
    return analyticsCount;
  }

  return Math.max(analyticsCount, Math.ceil(needed.value / packageAmount.value));
}
