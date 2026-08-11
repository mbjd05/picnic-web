import { describe, expect, it } from "vitest";

import { parseOfficialSearchSuggestions } from "@/lib/parse/search-suggestions";

describe("official search suggestions parser", () => {
  it("extracts clean unique suggestions from official search page items", () => {
    const rawPage = {
      id: "search-page-root-content",
      children: [
        {
          id: "search-suggestions-focused-block",
          children: [
            {
              id: "search-history-item-0",
              children: [{ markdown: "banaan" }],
            },
            {
              id: "search-history-item-1",
              children: [{ markdown: "#(#333333)**bio** banaan#(#333333)" }],
            },
            {
              id: "search-suggestion-component-outer-pml-2",
              children: [{ markdown: "banaan**tjes**" }],
            },
            {
              id: "search-suggestion-component-outer-pml-3",
              children: [{ markdown: "#(#333333)banaan#(#333333)" }],
            },
            {
              id: "core-search-recommendations-item-0",
              children: [{ markdown: "Zomerse salades" }],
            },
          ],
        },
      ],
    };

    expect(parseOfficialSearchSuggestions(rawPage)).toEqual([
      { id: "official-0-banaan", suggestion: "banaan" },
      { id: "official-1-bio banaan", suggestion: "bio banaan" },
      { id: "official-2-banaantjes", suggestion: "banaantjes" },
      { id: "official-3-zomerse salades", suggestion: "Zomerse salades" },
    ]);
  });

  it("ignores aggregate suggestion wrappers", () => {
    const rawPage = {
      id: "search-recommendations-root",
      children: [{ markdown: "Aggregate label" }],
    };

    expect(parseOfficialSearchSuggestions(rawPage)).toEqual([]);
  });
});
