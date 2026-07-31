import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { loadLocalEnvFile } from "./local-env.mjs";

loadLocalEnvFile();

const baseUrl = (process.env.PICNIC_WORKER_URL ?? "http://localhost:8791").replace(/\/$/, "");
const token = process.env.PICNIC_TOKEN;
const countryCode = (process.env.PICNIC_COUNTRY_CODE ?? "NL").toUpperCase();
const testCredentials = process.argv.includes("--credentials");
const REQUEST_TIMEOUT_MS = 30_000;

if (!token) {
  console.error("Missing PICNIC_TOKEN. See src/scripts/picnic-auth-probe.mjs.");
  process.exit(1);
}

if (!new Set(["NL", "DE"]).has(countryCode)) {
  console.error("PICNIC_COUNTRY_CODE must be NL or DE.");
  process.exit(1);
}

let cookieHeader = "";
const restorations = [];
const skipped = [];
let checks = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function recordSkip(message) {
  skipped.push(message);
  console.log(`SKIP ${message}`);
}

function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*picnic_(?:auth_token|country)=)/i).map((item) => item.trim());
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  return splitSetCookie(headers.get("set-cookie"));
}

function updateCookieJar(setCookies) {
  const cookies = new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return [part.slice(0, separator), part.slice(separator + 1)];
      })
  );

  for (const setCookie of setCookies) {
    const pair = setCookie.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) cookies.set(name, value);
    else cookies.delete(name);
  }

  cookieHeader = [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    expectedStatus = 200,
    authenticated = true,
    origin = baseUrl,
    expectJson = true,
    assertPrivateHeaders = path !== "/api/health" && !path.startsWith("/api/image"),
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = performance.now();

  try {
    const headers = new Headers();
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (authenticated && cookieHeader) headers.set("Cookie", cookieHeader);
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("Origin", origin);

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: controller.signal,
    });
    const duration = Math.round(performance.now() - startedAt);
    const setCookies = getSetCookies(response.headers);
    if (authenticated) updateCookieJar(setCookies);

    assert(
      response.status === expectedStatus,
      `${method} ${path} returned ${response.status}; expected ${expectedStatus}`
    );
    assert(
      response.headers.get("x-content-type-options") === "nosniff",
      `${method} ${path} is missing X-Content-Type-Options`
    );
    if (assertPrivateHeaders) {
      assert(
        response.headers.get("cache-control") === "no-store",
        `${method} ${path} is missing Cache-Control: no-store`
      );
    }

    const responseBody = expectJson ? await response.json() : await response.arrayBuffer();
    checks += 1;
    console.log(`PASS ${method} ${path.split("?")[0]} (${duration} ms)`);
    return { body: responseBody, headers: response.headers, setCookies };
  } finally {
    clearTimeout(timeout);
  }
}

function findCookie(setCookies, name) {
  return setCookies.find((value) => value.toLowerCase().startsWith(`${name.toLowerCase()}=`));
}

function cartQuantity(cart, productId) {
  return cart.items.find((item) => item.productId === productId)?.quantity ?? 0;
}

function cartQuantities(cart) {
  return new Map(cart.items.map((item) => [item.productId, item.quantity]));
}

function sameQuantities(left, right) {
  const ids = new Set([...left.keys(), ...right.keys()]);
  return [...ids].every((id) => (left.get(id) ?? 0) === (right.get(id) ?? 0));
}

async function mutateCart(productId, action, count) {
  return (
    await request("/api/cart", {
      method: "POST",
      body: { productId, action, count },
    })
  ).body;
}

async function restoreProductQuantity(productId, originalQuantity) {
  const cart = (await request("/api/cart")).body;
  const currentQuantity = cartQuantity(cart, productId);
  const difference = currentQuantity - originalQuantity;
  if (difference > 0) await mutateCart(productId, "remove", difference);
  if (difference < 0) await mutateCart(productId, "add", -difference);

  const restored = (await request("/api/cart")).body;
  assert(
    cartQuantity(restored, productId) === originalQuantity,
    `Failed to restore cart quantity for product ${productId}`
  );
}

async function promptHidden(rl, question) {
  const originalWrite = output.write;
  output.write = function maskedWrite(chunk, encoding, callback) {
    if (typeof chunk === "string" && chunk !== question) {
      return originalWrite.call(this, "*".repeat(chunk.length), encoding, callback);
    }
    return originalWrite.call(this, chunk, encoding, callback);
  };

  try {
    return await rl.question(question);
  } finally {
    output.write = originalWrite;
    output.write("\n");
  }
}

async function testCredentialLogin() {
  if (!testCredentials) {
    recordSkip("Hono credential + 2FA login (run again with --credentials)");
    return;
  }

  const rl = createInterface({ input, output });
  try {
    const email = (process.env.PICNIC_EMAIL ?? (await rl.question("Picnic email: "))).trim();
    const password = process.env.PICNIC_PASSWORD ?? (await promptHidden(rl, "Picnic password: "));
    const login = await request("/api/auth/login-credentials", {
      method: "POST",
      body: { email, password, countryCode },
    });

    if (login.body.success === true) return;
    assert(login.body.error === "2FA_REQUIRED", "Credential login did not succeed or request 2FA");

    const code = (await rl.question("Picnic 2FA code: ")).trim();
    const verification = await request("/api/auth/verify-2fa", {
      method: "POST",
      body: { partialToken: login.body.partialToken, code },
    });
    assert(verification.body.success === true, "Hono 2FA verification failed");
  } finally {
    rl.close();
  }
}

async function restoreAll() {
  const errors = [];
  while (restorations.length > 0) {
    const restoration = restorations.pop();
    try {
      await restoration.run();
      console.log(`RESTORED ${restoration.name}`);
    } catch (error) {
      errors.push(`${restoration.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (errors.length > 0) throw new Error(`Restoration failed:\n${errors.join("\n")}`);
}

async function main() {
  console.log(`Authenticated Worker smoke test: ${baseUrl} (${countryCode})`);
  console.log("Checkout and payment mutations are disabled by design.\n");

  await request("/api/health", { authenticated: false, assertPrivateHeaders: false });

  const unauthenticated = await request("/api/categories", {
    authenticated: false,
    expectedStatus: 401,
  });
  assert(
    unauthenticated.body.code === "TOKEN_EXPIRED",
    "Missing session response lacks TOKEN_EXPIRED"
  );

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { token, countryCode },
    authenticated: true,
  });
  assert(login.body.success === true, "Hono token login failed");
  assert(!("token" in login.body), "Login response exposed an auth token");

  const authCookie = findCookie(login.setCookies, "picnic_auth_token");
  const countryCookie = findCookie(login.setCookies, "picnic_country");
  assert(authCookie, "Token login did not set picnic_auth_token");
  assert(/;\s*httponly/i.test(authCookie), "Auth cookie is not HttpOnly");
  assert(/;\s*samesite=strict/i.test(authCookie), "Auth cookie is not SameSite=Strict");
  assert(/;\s*path=\//i.test(authCookie), "Auth cookie path is not /");
  assert(/;\s*max-age=2592000/i.test(authCookie), "Auth cookie lifetime is not 30 days");
  assert(countryCookie, "Token login did not set picnic_country");

  const rejected = await request("/api/cart", {
    method: "POST",
    body: { productId: "not-used", action: "add", count: 1 },
    origin: "https://example.invalid",
    expectedStatus: 403,
  });
  assert(
    rejected.body.error === "Invalid request origin",
    "Cross-origin mutation was not rejected"
  );

  await testCredentialLogin();

  const categories = (await request("/api/categories")).body;
  assert(
    Array.isArray(categories.categories) && categories.categories.length > 0,
    "No categories returned"
  );

  let category;
  let subcategories;
  for (const candidate of categories.categories.slice(0, 6)) {
    const response = (
      await request(`/api/categories/${encodeURIComponent(candidate.id)}/subcategories`)
    ).body;
    if (Array.isArray(response.subcategories) && response.subcategories.length > 0) {
      category = candidate;
      subcategories = response.subcategories;
      break;
    }
  }
  assert(category && subcategories, "Could not discover a category with subcategories");

  const subcategory = subcategories[0];
  const categoryProducts = (
    await request(`/api/categories/${encodeURIComponent(subcategory.id)}/products`)
  ).body;
  assert(Array.isArray(categoryProducts.products), "Category products response is malformed");

  const arbitraryPage = (
    await request(
      `/api/pages/products?pageId=${encodeURIComponent(
        `L2-category-page-root?category_id=${subcategory.id}`
      )}`
    )
  ).body;
  assert(Array.isArray(arbitraryPage.products), "Arbitrary products page response is malformed");

  const searchTerm = countryCode === "DE" ? "banane" : "banaan";
  const search = (await request(`/api/search?q=${encodeURIComponent(searchTerm)}`)).body;
  assert(
    Array.isArray(search.products) && search.products.length > 0,
    "Search returned no products"
  );
  assert(
    Array.isArray(search.sections) && search.sections.length > 0,
    "Search returned no sections"
  );

  const suggestions = (await request(`/api/suggestions?q=${encodeURIComponent(searchTerm)}`)).body;
  assert(Array.isArray(suggestions.suggestions), "Suggestions response is malformed");

  const product = search.products.find((item) => !item.isUnavailable && item.maxCount > 0);
  assert(product, "Search returned no mutable available product");
  const productDetail = (await request(`/api/product/${encodeURIComponent(product.id)}`)).body;
  assert(productDetail.id === product.id, "Product detail ID does not match");

  if (product.imageId) {
    const imageUrl = `https://storefront-prod.${countryCode.toLowerCase()}.picnicinternational.com/static/images/${product.imageId}/medium.png`;
    const image = await request(`/api/image?url=${encodeURIComponent(imageUrl)}`, {
      expectJson: false,
      assertPrivateHeaders: false,
    });
    assert(image.body.byteLength > 0, "Image proxy returned an empty body");
    assert(
      image.headers.get("cache-control")?.startsWith("public"),
      "Image proxy response is not publicly cacheable"
    );
  }

  const initialCart = (await request("/api/cart")).body;
  assert(Array.isArray(initialCart.items), "Cart response is malformed");
  const initialCartQuantities = cartQuantities(initialCart);
  const originalProductQuantity = cartQuantity(initialCart, product.id);
  assert(originalProductQuantity < product.maxCount, "Selected product is already at maxCount");

  restorations.push({
    name: "product cart quantity",
    run: () => restoreProductQuantity(product.id, originalProductQuantity),
  });
  const addedCart = await mutateCart(product.id, "add", 1);
  assert(
    cartQuantity(addedCart, product.id) === originalProductQuantity + 1,
    "Cart add was not applied"
  );
  await restoreProductQuantity(product.id, originalProductQuantity);
  restorations.pop();

  const slots = (await request("/api/cart/delivery-slots")).body;
  assert(Array.isArray(slots.dayGroups), "Delivery slots response is malformed");
  const originalSlotId = slots.selectedSlot?.slotId ?? null;
  const availableSlots = slots.dayGroups
    .flatMap((day) => [...day.greenSlots, ...day.regularSlots])
    .filter((slot) => slot.isAvailable);
  const alternateSlot = availableSlots.find((slot) => slot.slotId !== originalSlotId);

  if (originalSlotId && alternateSlot) {
    restorations.push({
      name: "delivery slot",
      run: async () => {
        await request("/api/cart/delivery-slots", {
          method: "POST",
          body: { slotId: originalSlotId },
        });
        const restored = (await request("/api/cart/delivery-slots")).body;
        assert(
          restored.selectedSlot?.slotId === originalSlotId,
          "Original delivery slot was not restored"
        );
      },
    });
    await request("/api/cart/delivery-slots", {
      method: "POST",
      body: { slotId: alternateSlot.slotId },
    });
    const changedSlots = (await request("/api/cart/delivery-slots")).body;
    assert(
      changedSlots.selectedSlot?.slotId === alternateSlot.slotId,
      "Delivery slot change was not applied"
    );
    await restorations.at(-1).run();
    restorations.pop();
  } else {
    recordSkip("delivery-slot mutation because no restorable selected/alternate pair exists");
  }

  const cookbook = (await request("/api/cookbook")).body;
  assert(
    Array.isArray(cookbook.recipes) && cookbook.recipes.length > 0,
    "Cookbook returned no recipes"
  );
  assert(Array.isArray(cookbook.categories), "Cookbook categories response is malformed");

  if (cookbook.categories.length > 0) {
    const scopedCookbook = (
      await request(`/api/cookbook?category=${encodeURIComponent(cookbook.categories[0].id)}`)
    ).body;
    assert(Array.isArray(scopedCookbook.recipes), "Cookbook category response is malformed");
  }

  const recipe = cookbook.recipes[0];
  const recipeSearchTerm = recipe.name.split(/\s+/)[0];
  const recipeSearch = (
    await request(`/api/cookbook/search?q=${encodeURIComponent(recipeSearchTerm)}`)
  ).body;
  assert(Array.isArray(recipeSearch.recipes), "Cookbook search response is malformed");

  const countsBefore = (await request("/api/cookbook/counts")).body;
  const savedBefore = (await request("/api/cookbook?category=__saved__")).body;
  assert(Array.isArray(savedBefore.recipes), "Saved cookbook response is malformed");

  const detail = (await request(`/api/recipe/${encodeURIComponent(recipe.id)}`)).body;
  assert(
    detail.id === recipe.id && Array.isArray(detail.ingredients),
    "Recipe detail is malformed"
  );
  const changedPortions = Math.max(1, (detail.portions ?? 2) + 1);
  const resizedDetail = (
    await request(`/api/recipe/${encodeURIComponent(recipe.id)}?portions=${changedPortions}`)
  ).body;
  assert(resizedDetail.portions === changedPortions, "Recipe portions were not applied");

  const wasSaved = savedBefore.recipes.some((item) => item.id === recipe.id);
  const toggleMethod = wasSaved ? "DELETE" : "POST";
  const restoreMethod = wasSaved ? "POST" : "DELETE";
  restorations.push({
    name: "saved recipe state",
    run: async () => {
      await request(`/api/recipe/${encodeURIComponent(recipe.id)}/saved`, {
        method: restoreMethod,
      });
      const restoredSaved = (await request("/api/cookbook?category=__saved__")).body;
      assert(
        restoredSaved.recipes.some((item) => item.id === recipe.id) === wasSaved,
        "Original saved recipe state was not restored"
      );
    },
  });
  await request(`/api/recipe/${encodeURIComponent(recipe.id)}/saved`, { method: toggleMethod });
  const savedAfterToggle = (await request("/api/cookbook?category=__saved__")).body;
  assert(
    savedAfterToggle.recipes.some((item) => item.id === recipe.id) !== wasSaved,
    "Saved recipe toggle was not applied"
  );
  const countsAfterToggle = (await request("/api/cookbook/counts")).body;
  if (
    typeof countsBefore.__saved__ === "number" &&
    typeof countsAfterToggle.__saved__ === "number"
  ) {
    const expectedDelta = wasSaved ? -1 : 1;
    assert(
      countsAfterToggle.__saved__ - countsBefore.__saved__ === expectedDelta,
      "Saved recipe count cache was not invalidated"
    );
  }
  await restorations.at(-1).run();
  restorations.pop();

  const ingredient = detail.ingredients.find(
    (item) => !item.isCondiment && item.id && item.maxCount > cartQuantity(initialCart, item.id)
  );
  if (ingredient) {
    const originalIngredientQuantity = cartQuantity(initialCart, ingredient.id);
    restorations.push({
      name: "recipe ingredient cart quantity",
      run: () => restoreProductQuantity(ingredient.id, originalIngredientQuantity),
    });
    await request(`/api/recipe/${encodeURIComponent(recipe.id)}/add-to-cart`, {
      method: "POST",
      body: {
        portions: detail.portions,
        selectedIngredients: [{ id: ingredient.id, count: 1 }],
      },
    });
    const recipeCart = (await request("/api/cart")).body;
    assert(
      cartQuantity(recipeCart, ingredient.id) === originalIngredientQuantity + 1,
      "Recipe selected-ingredient add-to-cart was not applied"
    );
    await restoreProductQuantity(ingredient.id, originalIngredientQuantity);
    restorations.pop();
  } else {
    recordSkip("recipe add-to-cart mutation because no restorable ingredient exists");
  }

  const paymentProfile = (await request("/api/account/payment-profile")).body;
  assert(!paymentProfile.error, "Payment profile read failed");

  const finalCart = (await request("/api/cart")).body;
  assert(
    sameQuantities(initialCartQuantities, cartQuantities(finalCart)),
    "Final cart quantities differ from the initial snapshot"
  );

  await request("/api/auth/logout", { method: "POST" });
  const loggedOut = await request("/api/categories", { expectedStatus: 401 });
  assert(loggedOut.body.code === "TOKEN_EXPIRED", "Logout did not invalidate the local session");

  console.log(`\nAuthenticated Worker smoke passed: ${checks} checks, ${skipped.length} skipped.`);
}

let mainError;
try {
  await main();
} catch (error) {
  mainError = error;
} finally {
  try {
    await restoreAll();
  } catch (restorationError) {
    console.error(restorationError instanceof Error ? restorationError.message : restorationError);
    process.exitCode = 2;
  }
}

if (mainError) {
  console.error(`Smoke test failed: ${mainError instanceof Error ? mainError.message : mainError}`);
  process.exitCode ||= 1;
}
