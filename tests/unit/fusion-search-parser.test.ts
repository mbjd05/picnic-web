import { describe, expect, it } from "vitest";

import { parseFusionSearchSections } from "@/lib/parse/fusion-search";

function sellingUnit(id: string, name: string) {
  return {
    type: "PML",
    id: `selling-unit-${id}-tile`,
    content: {
      type: "SELLING_UNIT",
      sellingUnit: {
        id,
        name,
        image_id: `${id}-image`,
        display_price: 199,
        unit_quantity: "1 stuk",
        max_count: 99,
        decorators: [],
        price_ranges: null,
      },
    },
  };
}

describe("Fusion search parser", () => {
  it("keeps unheaded all-results wrappers as their own section before headed sections", () => {
    const rawPage = {
      id: "search-page-results",
      children: [
        {
          id: "structured-selling-unit-search-result",
          children: [
            {
              id: "structured-selling-unit-search-result-visual-sections",
              children: [
                {
                  id: "client-side-filtering-section-wrapper-Alle resultaten",
                  children: [sellingUnit("s-direct-1", "Bananen")],
                },
                {
                  id: "client-side-filtering-section-wrapper-Alle resultaten__2",
                  children: [sellingUnit("s-direct-2", "Bio bananen")],
                },
                {
                  id: "client-side-filtering-section-header-wrapper-Bekijk ook",
                  children: [{ markdown: "Bekijk ook" }],
                },
                {
                  id: "client-side-filtering-section-wrapper-Bekijk ook",
                  children: [sellingUnit("s-related-1", "Banaanplakjes")],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseFusionSearchSections(rawPage);

    expect(result.sections).toHaveLength(2);
    expect(result.sections.map((section) => section.title)).toEqual([
      "Alle resultaten",
      "Bekijk ook",
    ]);
    expect(result.sections.map((section) => section.products.map((product) => product.id))).toEqual(
      [["s-direct-1", "s-direct-2"], ["s-related-1"]]
    );
  });
});
