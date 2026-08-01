export const CENTS_DIVISOR = 100;
export const DEFAULT_IMAGE_SIZE = "medium";
export const DEBOUNCE_DELAY_MS = 300;
export const MIN_SUGGESTION_LENGTH = 2;
export const SECTION_ID_PREFIX = "section";

/** Build a stable DOM id for a search result section by its index. */
export function buildSectionId(index: number): string {
  return `${SECTION_ID_PREFIX}-${index}`;
}
