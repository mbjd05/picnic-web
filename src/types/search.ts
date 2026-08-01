import type { Product } from "@/types/product";

export type SearchSection = {
  /** Display text for the section header (e.g., "Cherrytomaten"). */
  title: string;
  /** Products in this section, in API order. Always non-empty. */
  products: Product[];
};

export type SearchResult = {
  products: Product[];
  sections: SearchSection[];
  query: string;
};

export type SearchSuggestion = {
  id: string;
  suggestion: string;
};

export type SearchApiResponse = {
  products: Product[];
  sections: SearchSection[];
  query: string;
};

export type SuggestionsApiResponse = {
  suggestions: SearchSuggestion[];
  query: string;
};

export type CategoryProductsApiResponse = {
  title: string | null;
  products: Product[];
  sections: SearchSection[];
};
