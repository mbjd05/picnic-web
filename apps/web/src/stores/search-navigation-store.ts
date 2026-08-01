import { createStore, useSelector } from "@tanstack/react-store";

type SearchNavigationStore = {
  submittedProductSearch: string | null;
  setSubmittedProductSearch: (query: string | null) => void;
};

export const searchNavigationStore = createStore<SearchNavigationStore>({
  submittedProductSearch: null,
  setSubmittedProductSearch: (query) => {
    searchNavigationStore.setState((state) => ({
      ...state,
      submittedProductSearch: query?.trim() || null,
    }));
  },
});

export function useSearchNavigationStore<TSelected>(
  selector: (state: SearchNavigationStore) => TSelected
): TSelected {
  return useSelector(searchNavigationStore, selector);
}
