import { describe, expect, it } from "vitest";

import {
  assertAllowedPicnicShareUrl,
  buildRecipeSourceUrl,
  extractRecipeIdFromReference,
  isPotentialRecipeReference,
  isRecipeId,
  resolveRecipeReference,
} from "@/lib/recipes/recipe-reference";

const RECIPE_ID = "68887fc8a7799827d69c9be9";
const OWN_RECIPE_ID = "68887fc8a7799827d69c9be912345678";

describe("recipe reference helpers", () => {
  it("recognizes 24 and 32 character recipe ids", () => {
    expect(isRecipeId(RECIPE_ID)).toBe(true);
    expect(isRecipeId(OWN_RECIPE_ID)).toBe(true);
    expect(isRecipeId("s1018231")).toBe(false);
  });

  it("builds localized Picnic source URLs", () => {
    expect(buildRecipeSourceUrl("NL", RECIPE_ID)).toBe(
      `https://picnic.app/nl/recepten/${RECIPE_ID}`
    );
    expect(buildRecipeSourceUrl("DE", RECIPE_ID)).toBe(
      `https://picnic.app/de/rezepte/${RECIPE_ID}`
    );
    expect(buildRecipeSourceUrl("FR", RECIPE_ID)).toBe(
      `https://picnic.app/fr/recettes/${RECIPE_ID}`
    );
  });

  it("extracts ids from paths and query parameters", () => {
    expect(extractRecipeIdFromReference(`https://picnic.app/nl/recepten/${RECIPE_ID}/x`)).toBe(
      RECIPE_ID
    );
    expect(
      extractRecipeIdFromReference(`app.picnic://recipe?selling_group_id=${OWN_RECIPE_ID}`)
    ).toBe(OWN_RECIPE_ID);
    expect(extractRecipeIdFromReference(`recipe_id=${RECIPE_ID}`)).toBe(RECIPE_ID);
  });

  it("marks only ids and URLs as potential recipe references", () => {
    expect(isPotentialRecipeReference(RECIPE_ID)).toBe(true);
    expect(isPotentialRecipeReference("https://picnic.app/nl/go/share")).toBe(true);
    expect(isPotentialRecipeReference("pasta pesto")).toBe(false);
  });

  it("rejects non-https and non-Picnic URLs", () => {
    expect(() => assertAllowedPicnicShareUrl("http://picnic.app/nl/go/x")).toThrow("Only HTTPS");
    expect(() => assertAllowedPicnicShareUrl("https://example.com/recipe")).toThrow(
      "Only picnic.app"
    );
  });

  it("resolves short Picnic links after redirect host validation", async () => {
    const recipeId = await resolveRecipeReference("https://picnic.app/nl/go/share", async () => ({
      ok: true,
      status: 200,
      url: `https://picnic.app/nl/recepten/${RECIPE_ID}/title`,
    }));

    expect(recipeId).toBe(RECIPE_ID);
  });

  it("rejects share redirects away from picnic.app", async () => {
    await expect(
      resolveRecipeReference("https://picnic.app/nl/go/share", async () => ({
        ok: true,
        status: 200,
        url: `https://example.com/nl/recepten/${RECIPE_ID}`,
      }))
    ).rejects.toThrow("redirected away");
  });
});
