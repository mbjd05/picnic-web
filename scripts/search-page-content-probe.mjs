import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import PicnicClient from "picnic-api";

import { loadLocalEnvFile } from "./local-env.mjs";

/*
Official Picnic search Page Platform probe
==========================================

Read-only comparison of the current app search surfaces:

  node .\scripts\search-page-content-probe.mjs --runs=3 banaan "appel bio" kaas

The script prints sanitized counts and overlap metrics only. It does not print
tokens, product IDs, product names, raw payloads, request bodies, or response
bodies.
*/

loadLocalEnvFile();

const token = process.env.PICNIC_TOKEN;
const countryCode = process.env.PICNIC_COUNTRY_CODE ?? "NL";
const apiVersion = process.env.PICNIC_API_VERSION ?? "17";
const args = process.argv.slice(2);
const runsArg = args.find((arg) => arg.startsWith("--runs="));
const runs = Math.max(
  1,
  Math.min(Number.parseInt(runsArg?.slice("--runs=".length) ?? "3", 10), 10)
);
const queries = args
  .filter((arg) => !arg.startsWith("--runs="))
  .map((query) => query.trim())
  .filter(Boolean);

if (!token) {
  console.error("PICNIC_TOKEN is missing. Run: node .\\scripts\\picnic-auth-probe.mjs login");
  process.exit(1);
}

if (queries.length === 0) {
  queries.push("banaan", "appel bio", "kaas");
}

const client = new PicnicClient({
  countryCode,
  apiVersion,
  authKey: token,
});

function hashId(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function productIdFromSellingUnit(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const sellingUnit = value.sellingUnit;
  return sellingUnit && typeof sellingUnit === "object" && typeof sellingUnit.id === "string"
    ? sellingUnit.id
    : null;
}

function collectSellingUnitIds(value, ids = []) {
  const id = productIdFromSellingUnit(value);
  if (id) ids.push(id);

  if (!value || typeof value !== "object") return ids;
  if (Array.isArray(value)) {
    for (const item of value) collectSellingUnitIds(item, ids);
    return ids;
  }

  for (const child of Object.values(value)) collectSellingUnitIds(child, ids);
  return ids;
}

function collectMarkdowns(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) collectMarkdowns(item, result);
    return result;
  }

  if (typeof value.markdown === "string") result.push(value.markdown);
  for (const child of Object.values(value)) collectMarkdowns(child, result);
  return result;
}

function stripMarkup(value) {
  return value
    .replace(/<[^>]+>/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function firstText(value) {
  return collectMarkdowns(value).map(stripMarkup).find(Boolean) ?? "";
}

function findByIdSubstring(value, substring) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findByIdSubstring(item, substring);
      if (found) return found;
    }
    return null;
  }

  if (typeof value.id === "string" && value.id.includes(substring)) return value;
  for (const child of Object.values(value)) {
    const found = findByIdSubstring(child, substring);
    if (found) return found;
  }
  return null;
}

function parseSections(value) {
  const root = findByIdSubstring(value, "structured-selling-unit-search-result");
  const sections = [];
  if (!root || !Array.isArray(root.children)) return sections;

  walkSectionChildren(root.children, sections);
  const visual = findByIdSubstring(root, "structured-selling-unit-search-result-visual-sections");
  if (visual && Array.isArray(visual.children)) walkSectionChildren(visual.children, sections);

  const seenTitles = new Set();
  return sections.filter((section) => {
    const key = `${section.title}:${section.count}`;
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return section.count > 0;
  });
}

function walkSectionChildren(children, sections) {
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    const id = typeof child?.id === "string" ? child.id : "";
    if (!id.startsWith("client-side-filtering-section-header-wrapper-")) continue;

    const sectionKey = id.slice("client-side-filtering-section-header-wrapper-".length);
    const title = firstText(child) || sectionKey;
    const ids = [];

    for (let siblingIndex = index + 1; siblingIndex < children.length; siblingIndex++) {
      const sibling = children[siblingIndex];
      const siblingId = typeof sibling?.id === "string" ? sibling.id : "";
      if (siblingId.startsWith("client-side-filtering-section-header-wrapper-")) break;
      if (siblingId.includes("structured-selling-unit-search-result-visual-sections")) break;
      if (siblingId.includes(`client-side-filtering-section-wrapper-${sectionKey}`)) {
        collectSellingUnitIds(sibling, ids);
      }
    }

    const uniqueIds = [...new Set(ids)];
    sections.push({ title, count: uniqueIds.length });
  }
}

function summarizePage(value) {
  const ids = collectSellingUnitIds(value);
  const uniqueIds = [...new Set(ids)];
  return {
    productCount: uniqueIds.length,
    duplicateProductReferences: Math.max(0, ids.length - uniqueIds.length),
    sections: parseSections(value),
    productHashes: new Set(uniqueIds.map(hashId)),
  };
}

function summarizeCatalog(value) {
  const items = Array.isArray(value) ? value : [];
  const ids = items
    .map((item) => (item && typeof item === "object" ? item.id : null))
    .filter((id) => typeof id === "string");
  return {
    productCount: new Set(ids).size,
    productHashes: new Set(ids.map(hashId)),
  };
}

function compareSets(left, right) {
  let overlap = 0;
  for (const item of left) {
    if (right.has(item)) overlap++;
  }
  return {
    overlap,
    leftOnly: Math.max(0, left.size - overlap),
    rightOnly: Math.max(0, right.size - overlap),
  };
}

async function pageRequest(path) {
  return client.sendRequest("GET", path, null, true);
}

async function timed(label, action) {
  const start = performance.now();
  const value = await action();
  const durationMs = Math.round(performance.now() - start);
  return { label, durationMs, value };
}

function rootContentPath(query, variant) {
  const params = new URLSearchParams({
    search_term: query,
    search_session_id: randomUUID(),
    pending_search_session_id: randomUUID(),
    is_search_recommendations_active: variant === "focused" ? "true" : "false",
    is_text_input_focused: variant === "focused" ? "true" : "false",
    skip_initial_search_on_focus: "false",
  });
  return `/pages/search-page-root-content?${params.toString()}`;
}

async function summarizeQuery(query) {
  const currentPagePath = `/pages/search-page-results?search_term=${encodeURIComponent(query)}`;
  const submittedRootContentPath = rootContentPath(query, "submitted");
  const focusedRootContentPath = rootContentPath(query, "focused");
  const timings = [];

  const [currentPageResult, submittedRootContentResult, focusedRootContentResult, catalogResult] =
    await Promise.all([
      timed("current search-page-results", () => pageRequest(currentPagePath)),
      timed("official root-content submitted", () => pageRequest(submittedRootContentPath)),
      timed("official root-content focused", () => pageRequest(focusedRootContentPath)),
      timed("catalog.search", () => client.catalog.search(query)),
    ]);

  timings.push(
    ...[currentPageResult, submittedRootContentResult, focusedRootContentResult, catalogResult].map(
      ({ label, durationMs }) => ({ label, durationMs })
    )
  );

  const currentPage = currentPageResult.value;
  const submittedRootContent = submittedRootContentResult.value;
  const focusedRootContent = focusedRootContentResult.value;
  const catalog = catalogResult.value;

  const parseStart = performance.now();
  const current = summarizePage(currentPage);
  const currentParseMs = Math.round(performance.now() - parseStart);

  const submittedParseStart = performance.now();
  const submitted = summarizePage(submittedRootContent);
  const submittedParseMs = Math.round(performance.now() - submittedParseStart);

  const focusedParseStart = performance.now();
  const focused = summarizePage(focusedRootContent);
  const focusedParseMs = Math.round(performance.now() - focusedParseStart);

  const catalogParseStart = performance.now();
  const catalogSummary = summarizeCatalog(catalog);
  const catalogParseMs = Math.round(performance.now() - catalogParseStart);

  timings.push(
    { label: "parse current search-page-results", durationMs: currentParseMs },
    { label: "parse official root-content submitted", durationMs: submittedParseMs },
    { label: "parse official root-content focused", durationMs: focusedParseMs },
    { label: "parse catalog.search", durationMs: catalogParseMs },
    {
      label: "current production network critical path",
      durationMs: Math.max(currentPageResult.durationMs, catalogResult.durationMs),
    },
    {
      label: "single official root-content network path",
      durationMs: submittedRootContentResult.durationMs,
    }
  );

  return {
    query,
    countryCode,
    apiVersion,
    timings,
    catalog: { productCount: catalogSummary.productCount },
    currentSearchPageResults: {
      productCount: current.productCount,
      duplicateProductReferences: current.duplicateProductReferences,
      sections: current.sections,
      catalogOverlap: compareSets(current.productHashes, catalogSummary.productHashes),
    },
    officialRootContentSubmitted: {
      productCount: submitted.productCount,
      duplicateProductReferences: submitted.duplicateProductReferences,
      sections: submitted.sections,
      catalogOverlap: compareSets(submitted.productHashes, catalogSummary.productHashes),
      currentOverlap: compareSets(submitted.productHashes, current.productHashes),
    },
    officialRootContentFocused: {
      productCount: focused.productCount,
      duplicateProductReferences: focused.duplicateProductReferences,
      sections: focused.sections,
      catalogOverlap: compareSets(focused.productHashes, catalogSummary.productHashes),
      currentOverlap: compareSets(focused.productHashes, current.productHashes),
    },
  };
}

const summaries = [];
for (const query of queries) {
  const queryRuns = [];
  for (let run = 1; run <= runs; run++) {
    try {
      queryRuns.push({ run, ...(await summarizeQuery(query)) });
    } catch (error) {
      queryRuns.push({
        run,
        query,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  summaries.push(summarizeRuns(query, queryRuns));
}

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), summaries }, null, 2));

function summarizeRuns(query, queryRuns) {
  const successfulRuns = queryRuns.filter((run) => !run.error);
  if (successfulRuns.length === 0) return { query, runs: queryRuns };

  const timingLabels = [
    ...new Set(successfulRuns.flatMap((run) => run.timings.map((timing) => timing.label))),
  ];
  const timingSummary = Object.fromEntries(
    timingLabels.map((label) => {
      const values = successfulRuns
        .flatMap((run) => run.timings.filter((timing) => timing.label === label))
        .map((timing) => timing.durationMs)
        .sort((a, b) => a - b);
      return [
        label,
        {
          minMs: values[0],
          medianMs: values[Math.floor(values.length / 2)],
          maxMs: values[values.length - 1],
        },
      ];
    })
  );

  const latest = successfulRuns[successfulRuns.length - 1];
  return {
    query,
    runs: queryRuns.length,
    timingSummary,
    latestCoverage: {
      catalog: latest.catalog,
      currentSearchPageResults: latest.currentSearchPageResults,
      officialRootContentSubmitted: latest.officialRootContentSubmitted,
      officialRootContentFocused: latest.officialRootContentFocused,
    },
  };
}
