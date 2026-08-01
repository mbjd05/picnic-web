import type { Translations } from "@/lib/i18n/translations";

const ALL_RESULTS_PREFIXES = [
  "alle resultaten voor",
  "resultaten voor",
  "alle ergebnisse für",
  "ergebnisse für",
  "tous les résultats pour",
  "résultats pour",
  "all results for",
  "results for",
];

const SEE_ALSO_LABELS = new Set(["bekijk ook", "zie ook", "siehe auch", "voir aussi", "see also"]);

export function localizeApiSectionTitle(title: string, t: Translations): string {
  const normalized = title.trim();
  const lower = normalized.toLocaleLowerCase();

  if (SEE_ALSO_LABELS.has(lower)) return t.seeAlso;

  for (const prefix of ALL_RESULTS_PREFIXES) {
    if (!lower.startsWith(prefix)) continue;
    const remainder = normalized.slice(prefix.length).trim();
    const query = extractQuotedText(remainder);
    if (query) return `${t.allResultsFor} "${query}"`;
  }

  return title;
}

function extractQuotedText(value: string): string | null {
  const match = value.match(/^[“"](.+)[”"]$/u);
  return match?.[1] ?? null;
}
