import type { CountryCode } from "@/types/locale";
import type { PicnicLinkKind, PicnicLinkResolveResponse, ShareInfo } from "@/types/share";

const RECIPE_ID_RE = /^[a-f0-9]{24,32}$/i;
const RECIPE_ID_IN_URL_RE = /\/([a-f0-9]{24,32})(?:[/?#]|$)/i;
const RECIPE_ID_PARAM_RE = /(?:[?&#]|^)(?:selling_group_id|recipe_id)=([a-f0-9]{24,32})(?:[&#]|$)/i;
const PRODUCT_ID_RE = /^s\d+$/i;
const PRODUCT_ID_IN_URL_RE = /(?:[?&#,;]|^)id=(s\d+)(?:[,;&#]|$)/i;
const URL_LIKE_RE = /^https?:\/\//i;
const PICNIC_APP_SCHEME_RE = /^app\.picnic:\/\//i;
const SHARE_URL_RE = /https:\/\/picnic\.app\/[^\s)]+/i;
const ALLOWED_SHARE_HOSTS = new Set(["picnic.app"]);

type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Pick<Response, "url" | "ok" | "status">>;

export function isRecipeId(value: string): boolean {
  return RECIPE_ID_RE.test(value.trim());
}

export function isProductId(value: string): boolean {
  return PRODUCT_ID_RE.test(value.trim());
}

export function buildRecipeSourceUrl(countryCode: string, recipeId: string): string {
  const path =
    countryCode.toUpperCase() === "DE"
      ? "rezepte"
      : countryCode.toUpperCase() === "FR"
        ? "recettes"
        : "recepten";
  return `https://picnic.app/${countryCode.toLowerCase()}/${path}/${recipeId}`;
}

export function buildProductSourceUrl(countryCode: string, productId: string): string {
  return `https://picnic.app/${countryCode.toLowerCase()}/link/store/page;id=product-details-page-root,id=${productId},show_category_action=true,show_remove_from_purchases_page_action=false,shared_page=true`;
}

export function extractRecipeIdFromReference(input: string): string | null {
  const trimmed = input.trim();
  if (RECIPE_ID_RE.test(trimmed)) return trimmed;

  const pathMatch = trimmed.match(RECIPE_ID_IN_URL_RE);
  if (pathMatch) return pathMatch[1] ?? null;

  const paramMatch = trimmed.match(RECIPE_ID_PARAM_RE);
  return paramMatch?.[1] ?? null;
}

export function extractProductIdFromReference(input: string): string | null {
  const trimmed = input.trim();
  if (PRODUCT_ID_RE.test(trimmed)) return trimmed;

  const paramMatch = trimmed.match(PRODUCT_ID_IN_URL_RE);
  if (paramMatch) return paramMatch[1] ?? null;

  return null;
}

export function extractPicnicReferenceFromInput(
  input: string
): { kind: PicnicLinkKind; id: string } | null {
  const productId = extractProductIdFromReference(input);
  if (productId) return { kind: "product", id: productId };

  const recipeId = extractRecipeIdFromReference(input);
  if (recipeId) return { kind: "recipe", id: recipeId };

  return null;
}

export function isPotentialPicnicReference(input: string): boolean {
  const trimmed = input.trim();
  return Boolean(
    extractPicnicReferenceFromInput(trimmed) ||
    URL_LIKE_RE.test(trimmed) ||
    PICNIC_APP_SCHEME_RE.test(trimmed)
  );
}

export function isPotentialRecipeReference(input: string): boolean {
  const trimmed = input.trim();
  const reference = extractPicnicReferenceFromInput(trimmed);
  return Boolean(reference?.kind === "recipe" || URL_LIKE_RE.test(trimmed));
}

export function assertAllowedPicnicShareUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Not a valid Picnic link.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS Picnic links are supported.");
  }

  if (!isAllowedShareHost(url.hostname)) {
    throw new Error("Only picnic.app links are supported.");
  }

  return url;
}

export async function resolvePicnicReference(
  input: string,
  countryCode: CountryCode,
  fetchImpl: FetchLike = fetch
): Promise<PicnicLinkResolveResponse> {
  const trimmed = input.trim();
  const direct = extractPicnicReferenceFromInput(trimmed);
  if (direct) return buildResolvedLink(countryCode, direct.kind, direct.id);

  if (!URL_LIKE_RE.test(trimmed)) {
    throw new Error("Enter a Picnic product or recipe link.");
  }

  const startUrl = assertAllowedPicnicShareUrl(trimmed);
  const response = await fetchImpl(startUrl.href, { method: "HEAD", redirect: "follow" });
  const finalUrl = new URL(response.url || startUrl.href);

  if (!isAllowedShareHost(finalUrl.hostname)) {
    throw new Error("Picnic link redirected away from picnic.app.");
  }

  const resolved = extractPicnicReferenceFromInput(finalUrl.href);
  if (!resolved) {
    throw new Error("Could not find a product or recipe ID in this Picnic link.");
  }

  return buildResolvedLink(countryCode, resolved.kind, resolved.id);
}

export async function resolveRecipeReference(
  input: string,
  countryCode: CountryCode,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  const resolved = await resolvePicnicReference(input, countryCode, fetchImpl);
  if (resolved.kind !== "recipe") {
    throw new Error("This Picnic link points to a product, not a recipe.");
  }
  return resolved.id;
}

export function extractSocialShareInfo(input: unknown): ShareInfo | null {
  const action = findSocialShareAction(input);
  const message = typeof action?.message === "string" ? action.message.trim() : "";
  if (!message) return null;

  const url = message.match(SHARE_URL_RE)?.[0] ?? null;
  return { text: message, url };
}

function buildResolvedLink(
  countryCode: CountryCode,
  kind: PicnicLinkKind,
  id: string
): PicnicLinkResolveResponse {
  return {
    kind,
    id,
    sourceUrl:
      kind === "recipe"
        ? buildRecipeSourceUrl(countryCode, id)
        : buildProductSourceUrl(countryCode, id),
  };
}

function findSocialShareAction(input: unknown): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null) return null;

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findSocialShareAction(item);
      if (found) return found;
    }
    return null;
  }

  const record = input as Record<string, unknown>;
  if (record.type === "SOCIAL_SHARE") return record;

  for (const value of Object.values(record)) {
    const found = findSocialShareAction(value);
    if (found) return found;
  }

  return null;
}

function isAllowedShareHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_SHARE_HOSTS.has(host) || host.endsWith(".picnic.app");
}
