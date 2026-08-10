import { describe, expect, it } from "vitest";

import {
  assertAllowedPicnicShareUrl,
  buildProductSourceUrl,
  buildRecipeSourceUrl,
  extractPicnicReferenceFromInput,
  extractProductIdFromReference,
  extractRecipeIdFromReference,
  extractSocialShareInfo,
  isPotentialPicnicReference,
  isRecipeId,
  resolvePicnicReference,
  resolveRecipeReference,
} from "@/lib/picnic/share-links";

const RECIPE_ID = "68887fc8a7799827d69c9be9";
const OWN_RECIPE_ID = "68887fc8a7799827d69c9be912345678";
const PRODUCT_ID = "s1018231";

describe("Picnic share-link helpers", () => {
  it("recognizes recipe and product ids", () => {
    expect(isRecipeId(RECIPE_ID)).toBe(true);
    expect(isRecipeId(OWN_RECIPE_ID)).toBe(true);
    expect(isRecipeId(PRODUCT_ID)).toBe(false);
    expect(extractProductIdFromReference(PRODUCT_ID)).toBe(PRODUCT_ID);
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
    expect(buildProductSourceUrl("NL", PRODUCT_ID)).toContain(`id=${PRODUCT_ID}`);
  });

  it("extracts recipe ids from paths and query parameters", () => {
    expect(extractRecipeIdFromReference(`https://picnic.app/nl/recepten/${RECIPE_ID}/x`)).toBe(
      RECIPE_ID
    );
    expect(
      extractRecipeIdFromReference(`app.picnic://recipe?selling_group_id=${OWN_RECIPE_ID}`)
    ).toBe(OWN_RECIPE_ID);
    expect(extractRecipeIdFromReference(`recipe_id=${RECIPE_ID}`)).toBe(RECIPE_ID);
  });

  it("extracts product ids from Picnic deeplinks", () => {
    expect(
      extractProductIdFromReference(
        `https://picnic.app/nl/link/store/page;id=product-details-page-root,id=${PRODUCT_ID},shared_page=true`
      )
    ).toBe(PRODUCT_ID);
  });

  it("detects potential Picnic references without treating normal searches as links", () => {
    expect(isPotentialPicnicReference(RECIPE_ID)).toBe(true);
    expect(isPotentialPicnicReference(PRODUCT_ID)).toBe(true);
    expect(isPotentialPicnicReference("https://picnic.app/nl/go/share")).toBe(true);
    expect(isPotentialPicnicReference("pasta pesto")).toBe(false);
  });

  it("prefers product ids over page-root ids in link paths", () => {
    expect(
      extractPicnicReferenceFromInput(
        `https://picnic.app/nl/link/store/page;id=product-details-page-root,id=${PRODUCT_ID}`
      )
    ).toEqual({ kind: "product", id: PRODUCT_ID });
  });

  it("rejects non-https and non-Picnic URLs", () => {
    expect(() => assertAllowedPicnicShareUrl("http://picnic.app/nl/go/x")).toThrow("Only HTTPS");
    expect(() => assertAllowedPicnicShareUrl("https://example.com/recipe")).toThrow(
      "Only picnic.app"
    );
  });

  it("resolves short Picnic recipe links after redirect host validation", async () => {
    const resolved = await resolvePicnicReference(
      "https://picnic.app/nl/go/share",
      "NL",
      async () => ({
        ok: true,
        status: 200,
        url: `https://picnic.app/nl/recepten/${RECIPE_ID}/title`,
      })
    );

    expect(resolved).toEqual({
      kind: "recipe",
      id: RECIPE_ID,
      sourceUrl: `https://picnic.app/nl/recepten/${RECIPE_ID}`,
    });
    await expect(
      resolveRecipeReference("https://picnic.app/nl/go/share", "NL", async () => ({
        ok: true,
        status: 200,
        url: `https://picnic.app/nl/recepten/${RECIPE_ID}/title`,
      }))
    ).resolves.toBe(RECIPE_ID);
  });

  it("resolves short Picnic product links after redirect host validation", async () => {
    const resolved = await resolvePicnicReference(
      "https://picnic.app/nl/go/664hhbc",
      "NL",
      async () => ({
        ok: true,
        status: 200,
        url: `https://picnic.app/nl/link/store/page;id=product-details-page-root,id=${PRODUCT_ID},shared_page=true`,
      })
    );

    expect(resolved.kind).toBe("product");
    expect(resolved.id).toBe(PRODUCT_ID);
  });

  it("rejects share redirects away from picnic.app", async () => {
    await expect(
      resolvePicnicReference("https://picnic.app/nl/go/share", "NL", async () => ({
        ok: true,
        status: 200,
        url: `https://example.com/nl/recepten/${RECIPE_ID}`,
      }))
    ).rejects.toThrow("redirected away");
  });

  it("extracts Picnic social share action messages", () => {
    const info = extractSocialShareInfo({
      pml: {
        component: {
          onPress: {
            action: {
              type: "SOCIAL_SHARE",
              message: `Ik kwam dit product tegen bij Picnic: Bananen https://picnic.app/nl/go/664hhbc`,
            },
          },
        },
      },
    });

    expect(info).toEqual({
      text: "Ik kwam dit product tegen bij Picnic: Bananen https://picnic.app/nl/go/664hhbc",
      url: "https://picnic.app/nl/go/664hhbc",
    });
  });
});
