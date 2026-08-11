import { cleanMarkdown, collectMarkdowns } from "@/lib/pml/helpers";
import type { SearchSuggestion } from "@/types/search";

const SUGGESTION_ITEM_PREFIXES = [
  "search-history-item-",
  "search-suggestion-component-outer-pml-",
  "core-search-recommendations-item-",
];

type PmlRecord = Record<string, unknown>;

export function parseOfficialSearchSuggestions(rawPage: unknown): SearchSuggestion[] {
  const suggestions: SearchSuggestion[] = [];
  const seen = new Set<string>();
  const nodes = findSuggestionItemNodes(rawPage);

  for (const node of nodes) {
    const suggestion = collectMarkdowns(node).map(cleanSuggestionText).find(Boolean);
    if (!suggestion) continue;

    const key = suggestion.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      id: `official-${suggestions.length}-${key}`,
      suggestion,
    });
  }

  return suggestions;
}

function cleanSuggestionText(value: string): string {
  return cleanMarkdown(value).replace(/\s+/g, " ").trim();
}

function findSuggestionItemNodes(value: unknown, results: PmlRecord[] = []): PmlRecord[] {
  if (typeof value !== "object" || value === null) return results;

  if (Array.isArray(value)) {
    for (const item of value) findSuggestionItemNodes(item, results);
    return results;
  }

  const record = value as PmlRecord;
  const id = typeof record.id === "string" ? record.id : "";
  if (SUGGESTION_ITEM_PREFIXES.some((prefix) => id.startsWith(prefix))) {
    results.push(record);
    return results;
  }

  for (const child of Object.values(record)) {
    findSuggestionItemNodes(child, results);
  }

  return results;
}
