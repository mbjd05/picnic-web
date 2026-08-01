import { cleanMarkdown, collectMarkdowns } from "./pml-helpers";
import type { CountryCode } from "./locale-types";
import type { RecipeCategory } from "./recipe-types";

const MEALS_CATEGORY_PAGE_RE =
  /app\.picnic:\/\/store\/page;id=meals-category-page,category_id=([0-9a-f-]+)/i;
const MEALS_CATEGORY_GROUP_RE =
  /app\.picnic:\/\/store\/page;id=meals-category-group-page,group_name=([^,&]+)/i;
const MEALS_CATEGORY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_CATEGORY_ID_RE = /^recipe-cattree-[\w-]+$/;

const IGNORED_LABELS = new Set([
  "pml",
  "list_item",
  "12g",
  "0.1.0",
  "100%",
  "hidden",
  "rightChevron",
  "tik dubbel om te openen.",
  "Zum Öffnen doppeltippen.",
]);

type RecipePageClient = {
  app: {
    getPage: (pageId: string) => Promise<unknown>;
  };
};

type CategoryLink = RecipeCategory & {
  groupName?: string;
};

const DE_FALLBACK_CATEGORIES: RecipeCategory[] = [
  { id: "recipe-cattree-25min", name: "Blitzrezepte" },
  { id: "recipe-cattree-onepot", name: "One Pot" },
  { id: "recipe-cattree-pasta", name: "Pasta" },
  { id: "recipe-cattree-stuffedpasta", name: "Gefüllte Pasta" },
  { id: "recipe-cattree-lasagne", name: "Lasagne" },
  { id: "recipe-cattree-gnocchi", name: "Gnocchi" },
  { id: "recipe-cattree-noodles", name: "Nudeln" },
  { id: "recipe-cattree-schupfnudeln", name: "Schupfnudeln" },
  { id: "recipe-cattree-maultaschen", name: "Maultaschen" },
  { id: "recipe-cattree-spaetzle", name: "Spätzle" },
  { id: "recipe-cattree-asia-reis", name: "Asia & Reis" },
  { id: "recipe-cattree-risotto", name: "Risotto" },
  { id: "recipe-cattree-couscous", name: "Couscous" },
  { id: "recipe-cattree-bulgur", name: "Bulgur" },
  { id: "recipe-cattree-knoedel", name: "Knödel" },
  { id: "recipe-cattree-kartoffel", name: "Kartoffel" },
  { id: "recipe-cattree-suppen", name: "Suppen" },
  { id: "recipe-cattree-eintopf", name: "Eintopf" },
  { id: "recipe-cattree-curry2", name: "Curry" },
  { id: "recipe-cattree-l2-salad", name: "Salate" },
  { id: "recipe-cattree-bowls", name: "Bowls" },
  { id: "recipe-cattree-wraps", name: "Wraps" },
  { id: "recipe-cattree-pita2", name: "Pita" },
  { id: "recipe-cattree-l2-burger", name: "Burger" },
  { id: "recipe-cattree-quiche", name: "Quiche" },
  { id: "recipe-cattree-traybake", name: "Traybake" },
  { id: "recipe-cattree-auflaufe", name: "Aufläufe" },
  { id: "recipe-cattree-l2-pizza", name: "Pizza" },
  { id: "recipe-cattree-vegetarisch", name: "Vegetarisch" },
  { id: "recipe-cattree-vegan", name: "Vegan" },
  { id: "recipe-cattree-highinveg", name: "Viel Gemüse" },
  { id: "recipe-cattree-brunch", name: "Brunch" },
  { id: "recipe-cattree-aperitif", name: "Aperitif" },
  { id: "recipe-cattree-dessert", name: "Dessert" },
  { id: "recipe-cattree-abendbrot", name: "Abendbrot" },
  { id: "recipe-cattree-bbq", name: "BBQ" },
  { id: "recipe-cattree-l2-party", name: "Party" },
  { id: "recipe-cattree-basic", name: "Basics" },
  { id: "recipe-cattree-baking", name: "Backen" },
  { id: "recipe-cattree-snacks", name: "Snacks" },
  { id: "recipe-cattree-getraenke", name: "Getränke" },
  { id: "recipe-cattree-airfryer", name: "Airfryer" },
  { id: "recipe-cattree-budget", name: "Budget" },
  { id: "recipe-cattree-jamieoliver", name: "Jamie Oliver" },
  { id: "recipe-cattree-season", name: "Saisonal" },
  { id: "recipe-cattree-l2-kids", name: "Für Kinder" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectStrings(value: unknown, strings: string[] = []): string[] {
  if (typeof value === "string") {
    strings.push(value);
    return strings;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, strings);
    return strings;
  }
  if (isRecord(value)) {
    for (const child of Object.values(value)) collectStrings(child, strings);
  }
  return strings;
}

function collectPropertyStrings(value: unknown, key: string, strings: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectPropertyStrings(item, key, strings);
    return strings;
  }
  if (!isRecord(value)) return strings;

  if (typeof value[key] === "string") strings.push(value[key]);
  for (const child of Object.values(value)) collectPropertyStrings(child, key, strings);
  return strings;
}

function getPageSection(node: Record<string, unknown>): string | undefined {
  const analytics = node.analytics as { contexts?: unknown[] } | undefined;
  for (const context of analytics?.contexts ?? []) {
    if (!isRecord(context)) continue;
    const schema = context.schema;
    const data = context.data;
    if (
      typeof schema === "string" &&
      schema.includes("/page_section/") &&
      isRecord(data) &&
      typeof data.name === "string"
    ) {
      return data.name;
    }
  }
  return undefined;
}

function getCategoryName(node: unknown, section?: string): string | null {
  const candidates = [
    ...collectMarkdowns(node).map(cleanMarkdown),
    ...collectPropertyStrings(node, "accessibilityLabel").map(cleanMarkdown),
  ].filter((label) => {
    if (!label || label === section) return false;
    if (label.includes("iglu:") || label.includes("app.picnic://")) return false;
    return !IGNORED_LABELS.has(label);
  });

  return candidates.at(-1) ?? null;
}

function parseCategoryLinks(rawPage: unknown, fallbackSection?: string): CategoryLink[] {
  const links: CategoryLink[] = [];

  function visit(node: unknown) {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isRecord(node)) return;

    if (node.type === "PML") {
      const strings = collectStrings(node);
      const categoryTarget = strings.find((value) => MEALS_CATEGORY_PAGE_RE.test(value));
      const groupTarget = strings.find((value) => MEALS_CATEGORY_GROUP_RE.test(value));
      const section = getPageSection(node) ?? fallbackSection;
      const name = getCategoryName(node, section);

      if (categoryTarget && name) {
        const id = categoryTarget.match(MEALS_CATEGORY_PAGE_RE)?.[1];
        if (id) links.push({ id, name, section });
      } else if (groupTarget && name) {
        const groupName = groupTarget.match(MEALS_CATEGORY_GROUP_RE)?.[1];
        if (groupName) {
          links.push({
            id: `group:${decodeURIComponent(groupName)}`,
            name,
            section,
            groupName: decodeURIComponent(groupName),
          });
        }
      }
    }

    for (const child of Object.values(node)) visit(child);
  }

  visit(rawPage);
  return links;
}

function dedupeCategories(categories: RecipeCategory[]): RecipeCategory[] {
  const seen = new Set<string>();
  const result: RecipeCategory[] = [];
  for (const category of categories) {
    if (seen.has(category.id)) continue;
    seen.add(category.id);
    result.push(category);
  }
  return result;
}

export function isRecipeCategoryId(categoryId: string): boolean {
  return MEALS_CATEGORY_UUID_RE.test(categoryId) || LEGACY_CATEGORY_ID_RE.test(categoryId);
}

export async function fetchRecipeCategoryPage(
  client: RecipePageClient,
  categoryId: string
): Promise<unknown> {
  if (MEALS_CATEGORY_UUID_RE.test(categoryId)) {
    return client.app.getPage(`meals-category-page-content?category_id=${categoryId}`);
  }
  return client.app.getPage(categoryId);
}

export async function discoverRecipeCategories(
  client: RecipePageClient,
  rootPage: unknown,
  countryCode: CountryCode
): Promise<RecipeCategory[]> {
  const rootLinks = parseCategoryLinks(rootPage);
  const categories = rootLinks.filter((link) => !link.groupName);
  const groups = rootLinks.filter((link) => link.groupName);

  const groupCategories = await Promise.all(
    groups.map(async (group) => {
      try {
        const page = await client.app.getPage(
          `meals-category-group-page?group_name=${encodeURIComponent(group.groupName ?? "")}`
        );
        return parseCategoryLinks(page, group.name).filter((link) => !link.groupName);
      } catch {
        return [];
      }
    })
  );

  const discovered = dedupeCategories([...categories, ...groupCategories.flat()]);
  if (discovered.length > 0) return discovered;

  return countryCode === "DE" ? DE_FALLBACK_CATEGORIES : [];
}
