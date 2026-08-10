const RECIPE_ID_RE = /^[a-f0-9]{24,32}$/i;
const RECIPE_ID_IN_URL_RE = /\/([a-f0-9]{24,32})(?:[/?#]|$)/i;
const ID_PARAM_RE = /(?:[?&#]|^)(?:selling_group_id|recipe_id)=([a-f0-9]{24,32})(?:[&#]|$)/i;
const URL_LIKE_RE = /^https?:\/\//i;
const ALLOWED_SHARE_HOSTS = new Set(["picnic.app"]);

type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Pick<Response, "url" | "ok" | "status">>;

export function isRecipeId(value: string): boolean {
  return RECIPE_ID_RE.test(value.trim());
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

export function extractRecipeIdFromReference(input: string): string | null {
  const trimmed = input.trim();
  if (RECIPE_ID_RE.test(trimmed)) return trimmed;

  const pathMatch = trimmed.match(RECIPE_ID_IN_URL_RE);
  if (pathMatch) return pathMatch[1] ?? null;

  const paramMatch = trimmed.match(ID_PARAM_RE);
  return paramMatch?.[1] ?? null;
}

export function isPotentialRecipeReference(input: string): boolean {
  const trimmed = input.trim();
  return Boolean(extractRecipeIdFromReference(trimmed) || URL_LIKE_RE.test(trimmed));
}

export function assertAllowedPicnicShareUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Not a valid Picnic recipe URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS Picnic recipe links are supported.");
  }

  if (!isAllowedShareHost(url.hostname)) {
    throw new Error("Only picnic.app recipe links are supported.");
  }

  return url;
}

export async function resolveRecipeReference(
  input: string,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  const trimmed = input.trim();
  const directId = extractRecipeIdFromReference(trimmed);
  if (directId) return directId;

  if (!URL_LIKE_RE.test(trimmed)) {
    throw new Error("Enter a Picnic recipe link or recipe ID.");
  }

  const startUrl = assertAllowedPicnicShareUrl(trimmed);
  const response = await fetchImpl(startUrl.href, { method: "HEAD", redirect: "follow" });
  const finalUrl = new URL(response.url || startUrl.href);

  if (!isAllowedShareHost(finalUrl.hostname)) {
    throw new Error("Recipe link redirected away from picnic.app.");
  }

  const resolvedId = extractRecipeIdFromReference(finalUrl.href);
  if (!resolvedId) {
    throw new Error("Could not find a recipe ID in this Picnic link.");
  }

  return resolvedId;
}

function isAllowedShareHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_SHARE_HOSTS.has(host) || host.endsWith(".picnic.app");
}
