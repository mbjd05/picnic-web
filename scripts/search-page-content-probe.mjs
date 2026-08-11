import { createHash, randomUUID } from "node:crypto";

import PicnicClient from "picnic-api";

import { loadLocalEnvFile } from "./local-env.mjs";

/*
Official Picnic search Page Platform probe
==========================================

Read-only comparison of the current app search surfaces:

  node .\scripts\search-page-content-probe.mjs banaan "appel bio" kaas

The script prints sanitized counts and overlap metrics only. It does not print
tokens, product IDs, product names, raw payloads, request bodies, or response
bodies.
*/

loadLocalEnvFile();

const token = process.env.PICNIC_TOKEN;
const countryCode = process.env.PICNIC_COUNTRY_CODE ?? "NL";
const apiVersion = process.env.PICNIC_API_VERSION ?? "17";
const queries = process.argv
  .slice(2)
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
  const currentPagePromise = pageRequest(
    `/pages/search-page-results?search_term=${encodeURIComponent(query)}`
  );
  const submittedRootContentPromise = pageRequest(rootContentPath(query, "submitted"));
  const focusedRootContentPromise = pageRequest(rootContentPath(query, "focused"));
  const catalogPromise = client.catalog.search(query);

  const [currentPage, submittedRootContent, focusedRootContent, catalog] = await Promise.all([
    currentPagePromise,
    submittedRootContentPromise,
    focusedRootContentPromise,
    catalogPromise,
  ]);

  const current = summarizePage(currentPage);
  const submitted = summarizePage(submittedRootContent);
  const focused = summarizePage(focusedRootContent);
  const catalogSummary = summarizeCatalog(catalog);

  return {
    query,
    countryCode,
    apiVersion,
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
  try {
    summaries.push(await summarizeQuery(query));
  } catch (error) {
    summaries.push({
      query,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), summaries }, null, 2));
