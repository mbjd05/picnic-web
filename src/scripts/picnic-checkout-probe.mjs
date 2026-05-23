import PicnicClient from "picnic-api";

/*
Useful probe commands
=====================

Environment:

  $env:PICNIC_TOKEN="YOUR_AUTH_KEY"
  $env:PICNIC_COUNTRY_CODE="NL"
  $env:PICNIC_API_VERSION="17"
  $env:PICNIC_APP_RETURN_URL="http://localhost:3000/cart/payment-return"

Read-only checks:

  node .\scripts\picnic-checkout-probe.mjs cart
  node .\scripts\picnic-checkout-probe.mjs slots
  node .\scripts\picnic-checkout-probe.mjs minimum
  node .\scripts\picnic-checkout-probe.mjs payment-profile
  node .\scripts\picnic-checkout-probe.mjs available-payment-methods

Payment option setup:

  node .\scripts\picnic-checkout-probe.mjs ensure-ideal asn
  node .\scripts\picnic-checkout-probe.mjs ensure-ideal ing
  node .\scripts\picnic-checkout-probe.mjs ensure-payment-option IDEAL ASNBNL21
  node .\scripts\picnic-checkout-probe.mjs ensure-payment-option MAESTRO RABONL2U

Confirmed payment-profile routes:

  GET    /payment-profile
  POST   /payment-profile/payment-options
  DELETE /payment-profile/payment-options/{payment_option_id}

Important:
  POST and DELETE payment-option routes may return an empty success body.
  picnic-api may throw "Unexpected end of JSON input".
  Treat that as possibly successful, then verify by re-reading GET /payment-profile.

Checkout/payment:

  node .\scripts\picnic-checkout-probe.mjs checkout-start

  $env:PICNIC_APP_RETURN_URL="http://localhost:3000/cart/payment-return"; node .\scripts\picnic-checkout-probe.mjs checkout-payment

  $env:PICNIC_APP_RETURN_URL="http://localhost:3000/cart/payment-return"; node .\scripts\picnic-checkout-probe.mjs checkout-payment-safe

  $env:PICNIC_APP_RETURN_URL="http://localhost:3000/cart/payment-return"; node .\scripts\picnic-checkout-probe.mjs full-payment-flow IDEAL asn

  $env:PICNIC_APP_RETURN_URL="http://localhost:3000/cart/payment-return"; node .\scripts\picnic-checkout-probe.mjs full-payment-flow IDEAL asn --keep

Cancellation/status:

  node .\scripts\picnic-checkout-probe.mjs checkout-cancel TRANSACTION_ID_HERE
  node .\scripts\picnic-checkout-probe.mjs checkout-status TRANSACTION_ID_HERE
  node .\scripts\picnic-checkout-probe.mjs order-status ORDER_ID_HERE

Payment option removal:

  node .\scripts\picnic-checkout-probe.mjs payment-profile
  node .\scripts\picnic-checkout-probe.mjs remove-payment-option OPTION_ID_HERE --confirm

The removal command only removes one explicit payment option ID and requires --confirm.
*/

const token = process.env.PICNIC_TOKEN;
const countryCode = process.env.PICNIC_COUNTRY_CODE ?? "NL";
const apiVersion = process.env.PICNIC_API_VERSION ?? "17";
const mode = process.argv[2] ?? "cart";

if (!token) {
  console.error("Missing PICNIC_TOKEN environment variable.");
  process.exit(1);
}

const client = new PicnicClient({
  countryCode,
  apiVersion,
  authKey: token,
});

async function send(method, path, body = null, includeFusion = true) {
  return client.sendRequest(method, path, body, includeFusion);
}

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

function printError(error) {
  const status = error?.response?.status;
  const data = error?.response?.data ?? error?.message ?? error;

  if (status) {
    console.error(`Status: ${status}`);
  }

  console.error(data);
}

function resolveBankId(value) {
  const bankAliases = {
    asn: "ASNBNL21",
    ing: "INGBNL2A",
    rabobank: "RABONL2U",
    rabo: "RABONL2U",
    abn: "ABNANL2A",
    knab: "KNABNL2H",
    bunq: "BUNQNL2A",
    sns: "SNSBNL2A",
    triodos: "TRIONL2U",
    revolut: "REVOLT21",
    n26: "NTSBDEB1",
    nn: "NNBANL2G",
    yoursafe: "BITSNL2A",
    adyen: "ADYBNL2A",
    finom: "FNOMNL22",
    buut: "BUUTNL2A",
    regiobank: "RBRBNL21",
    vanlanschot: "FVLBNL22",
  };

  return bankAliases[value?.toLowerCase()] ?? value;
}

async function getPaymentProfile() {
  if (client.payment?.getPaymentProfile) {
    return client.payment.getPaymentProfile();
  }

  return send("GET", "/payment-profile", null, true);
}

function getPreferredPaymentOption(profile) {
  const preferredId = profile?.preferred_payment_option_id;

  if (!preferredId) return null;

  return profile?.stored_payment_options?.find((option) => option.id === preferredId) ?? null;
}

function getPreferredPaymentOptionForMethod(profile, paymentMethod) {
  const preferred = getPreferredPaymentOption(profile);

  if (!preferred) return null;

  return preferred.payment_method === paymentMethod ? preferred : null;
}

function getAvailablePaymentMethod(profile, paymentMethod) {
  return (
    profile?.available_payment_methods?.find((method) => method.payment_method === paymentMethod) ??
    null
  );
}

function isPaymentMethodAvailable(profile, paymentMethod, bankId = null) {
  const available = getAvailablePaymentMethod(profile, paymentMethod);

  if (!available) return false;

  if (!available.available_banks?.length) return true;

  return Boolean(bankId && available.available_banks.some((bank) => bank.bank_id === bankId));
}

function buildPaymentOptionBody(paymentMethod, bankId = null) {
  if (bankId) {
    return {
      payment_method: paymentMethod,
      bank_id: bankId,
    };
  }

  return {
    payment_method: paymentMethod,
  };
}

async function createPaymentOption(paymentMethod, bankId = null) {
  const body = buildPaymentOptionBody(paymentMethod, bankId);

  try {
    return await send("POST", "/payment-profile/payment-options", body, true);
  } catch (error) {
    const message = getErrorMessage(error);

    if (!message.includes("Unexpected end of JSON input")) {
      throw error;
    }

    return null;
  }
}

async function ensurePaymentOption(paymentMethod, bankId = null) {
  const before = await getPaymentProfile();

  const alreadyPreferred = getPreferredPaymentOptionForMethod(before, paymentMethod);

  if (alreadyPreferred) {
    return {
      profile: before,
      changed: false,
      preferredOption: alreadyPreferred,
    };
  }

  if (!isPaymentMethodAvailable(before, paymentMethod, bankId)) {
    throw new Error(
      bankId
        ? `Payment method is not available for this account: ${paymentMethod} / ${bankId}`
        : `Payment method is not available for this account: ${paymentMethod}`
    );
  }

  await createPaymentOption(paymentMethod, bankId);

  const after = await getPaymentProfile();
  const preferredAfter = getPreferredPaymentOptionForMethod(after, paymentMethod);

  if (!preferredAfter) {
    throw new Error(`Payment option was not stored as preferred: ${paymentMethod}`);
  }

  return {
    profile: after,
    changed: true,
    preferredOption: preferredAfter,
  };
}

async function removePaymentOption(paymentOptionId) {
  const before = await getPaymentProfile();

  const existsBefore = before.stored_payment_options?.some(
    (option) => option.id === paymentOptionId
  );

  if (!existsBefore) {
    throw new Error(`Payment option does not exist in current profile: ${paymentOptionId}`);
  }

  try {
    await send(
      "DELETE",
      `/payment-profile/payment-options/${encodeURIComponent(paymentOptionId)}`,
      null,
      true
    );
  } catch (error) {
    const message = getErrorMessage(error);

    if (!message.includes("Unexpected end of JSON input")) {
      throw error;
    }
  }

  const after = await getPaymentProfile();

  const stillExists = after.stored_payment_options?.some((option) => option.id === paymentOptionId);

  if (stillExists) {
    throw new Error(`Payment option still exists after DELETE: ${paymentOptionId}`);
  }

  return after;
}

async function startCheckout() {
  const cart = await client.cart.getCart();

  console.error("About to call POST /cart/checkout/start using cart.mts:", cart.mts);
  console.error("This may reserve/start checkout for the current cart.");

  const checkout = await send("POST", "/cart/checkout/start", {
    mts: cart.mts,
    oos_article_ids: null,
  });

  if (!checkout?.order_id) {
    throw new Error("No order_id returned by /cart/checkout/start.");
  }

  return checkout;
}

async function initiatePayment(orderId, appReturnUrl) {
  const payment = await send("POST", "/cart/checkout/initiate_payment", {
    order_id: orderId,
    app_return_url: appReturnUrl,
  });

  const redirectUrl = payment?.action?.redirect_url ?? payment?.issuer_authentication_url ?? null;

  if (!payment?.transaction_id) {
    throw new Error("No transaction_id returned by /cart/checkout/initiate_payment.");
  }

  if (!redirectUrl) {
    throw new Error("No redirect URL returned by /cart/checkout/initiate_payment.");
  }

  return {
    payment,
    redirectUrl,
  };
}

async function startCheckoutPayment() {
  const checkout = await startCheckout();

  console.error("checkout/start result:");
  print(checkout);

  const appReturnUrl =
    process.env.PICNIC_APP_RETURN_URL ?? "http://localhost:3000/cart/payment-return";

  console.error(
    "About to call POST /cart/checkout/initiate_payment using order_id:",
    checkout.order_id
  );
  console.error("Using app_return_url:", appReturnUrl);

  const { payment, redirectUrl } = await initiatePayment(checkout.order_id, appReturnUrl);

  console.error("checkout/initiate_payment result:");
  print(payment);

  return {
    order_id: checkout.order_id,
    payment_id: payment?.payment_id ?? null,
    transaction_id: payment?.transaction_id ?? null,
    redirect_url: redirectUrl,
    transaction_expiry: checkout?.transaction_expiry ?? null,
    raw_payment: payment,
  };
}

async function cancelCheckoutTransaction(transactionId) {
  const result = await send("POST", "/cart/checkout/cancel", {
    transaction_id: transactionId,
  });

  return result ?? { ok: true };
}

async function main() {
  if (mode === "cart") {
    const cart = await client.cart.getCart();

    print({
      id: cart.id,
      mts: cart.mts,
      total_count: cart.total_count,
      total_price: cart.total_price,
      checkout_total_price: cart.checkout_total_price,
      selected_slot: cart.selected_slot,
      delivery_slots_count: cart.delivery_slots?.length ?? 0,
      has_state_token: Boolean(cart.state_token),
      state_token_prefix: cart.state_token ? cart.state_token.slice(0, 32) + "..." : null,
      fees: cart.fees,
      deposit_breakdown: cart.deposit_breakdown,
      basket_sections: cart.basket_sections,
      first_items: cart.items?.slice(0, 5).map((line) => ({
        id: line.id,
        display_price: line.display_price,
        price: line.price,
        items: line.items?.map((item) => ({
          id: item.id,
          name: item.name,
          max_count: item.max_count,
          unit_quantity: item.unit_quantity,
        })),
      })),
    });

    return;
  }

  if (mode === "slots") {
    const slots = await client.cart.getDeliverySlots();
    print(slots);
    return;
  }

  if (mode === "minimum") {
    const minimum = await client.cart.getMinimumOrderValue();
    print(minimum);
    return;
  }

  if (mode === "payment-profile") {
    const profile = await getPaymentProfile();
    print(profile);
    return;
  }

  if (mode === "available-payment-methods") {
    const profile = await getPaymentProfile();

    print({
      available_payment_methods: profile.available_payment_methods ?? [],
      payment_methods: profile.payment_methods ?? [],
      stored_payment_options: profile.stored_payment_options ?? [],
      preferred_payment_option_id: profile.preferred_payment_option_id ?? null,
      preferred_payment_option: getPreferredPaymentOption(profile),
    });

    return;
  }

  if (mode === "ensure-payment-option") {
    const paymentMethod = process.argv[3];
    const rawBankId = process.argv[4];
    const bankId = rawBankId ? resolveBankId(rawBankId) : null;

    if (!paymentMethod) {
      console.error(
        "Usage: node scripts/picnic-checkout-probe.mjs ensure-payment-option <paymentMethod> [bankId|alias]"
      );
      console.error(
        "Example: node scripts/picnic-checkout-probe.mjs ensure-payment-option IDEAL asn"
      );
      console.error(
        "Example: node scripts/picnic-checkout-probe.mjs ensure-payment-option MAESTRO RABONL2U"
      );
      process.exit(1);
    }

    const result = await ensurePaymentOption(paymentMethod, bankId);

    print({
      changed: result.changed,
      preferred_option: result.preferredOption,
      profile: result.profile,
    });

    return;
  }

  if (mode === "ensure-ideal") {
    const rawBankId = process.argv[3] ?? "asn";
    const bankId = resolveBankId(rawBankId);

    const result = await ensurePaymentOption("IDEAL", bankId);

    print({
      changed: result.changed,
      preferred_option: result.preferredOption,
      profile: result.profile,
    });

    return;
  }

  if (mode === "remove-payment-option") {
    const paymentOptionId = process.argv[3];
    const confirmed = process.argv.includes("--confirm");

    if (!paymentOptionId || !confirmed) {
      console.error(
        "Usage: node scripts/picnic-checkout-probe.mjs remove-payment-option <paymentOptionId> --confirm"
      );
      console.error("");
      console.error("First inspect stored options with:");
      console.error("  node .\\scripts\\picnic-checkout-probe.mjs payment-profile");
      console.error("");
      console.error("Then remove one explicit option ID only:");
      console.error(
        "  node .\\scripts\\picnic-checkout-probe.mjs remove-payment-option OPTION_ID --confirm"
      );
      process.exit(1);
    }

    console.error("Payment profile before removal:");
    const before = await getPaymentProfile();
    print(before);

    console.error(`\n=== DELETE /payment-profile/payment-options/${paymentOptionId} ===`);

    const after = await removePaymentOption(paymentOptionId);

    console.error("\nPayment profile after removal:");
    print(after);

    console.error(`\nRemoved payment option: ${paymentOptionId}`);
    return;
  }

  if (mode === "checkout-start") {
    const checkout = await startCheckout();
    print(checkout);
    return;
  }

  if (mode === "checkout-payment") {
    const result = await startCheckoutPayment();
    print(result);
    return;
  }

  if (mode === "checkout-payment-safe") {
    const result = await startCheckoutPayment();
    print(result);

    if (!result.transaction_id) {
      throw new Error("No transaction_id returned; cannot auto-cancel.");
    }

    console.error("\nAuto-cancelling transaction:", result.transaction_id);

    const cancelResult = await cancelCheckoutTransaction(result.transaction_id);

    console.error("checkout/cancel result:");
    print(cancelResult);

    return;
  }

  if (mode === "full-payment-flow") {
    const paymentMethod = process.argv[3] ?? "IDEAL";
    const rawBankId = process.argv[4] ?? (paymentMethod === "IDEAL" ? "asn" : null);
    const bankId = rawBankId ? resolveBankId(rawBankId) : null;
    const keep = process.argv.includes("--keep");

    console.error("Ensuring preferred payment option:", {
      payment_method: paymentMethod,
      bank_id: bankId,
    });

    const ensureResult = await ensurePaymentOption(paymentMethod, bankId);

    console.error("Preferred payment option:");
    print(ensureResult.preferredOption);

    const paymentResult = await startCheckoutPayment();

    print({
      payment_option_changed: ensureResult.changed,
      preferred_payment_option: ensureResult.preferredOption,
      checkout_payment: paymentResult,
    });

    if (!keep) {
      console.error("\nAuto-cancelling transaction:", paymentResult.transaction_id);

      const cancelResult = await cancelCheckoutTransaction(paymentResult.transaction_id);

      console.error("checkout/cancel result:");
      print(cancelResult);
    } else {
      console.error("\nTransaction kept because --keep was passed.");
      console.error("Cancel manually with:");
      console.error(
        `node scripts/picnic-checkout-probe.mjs checkout-cancel ${paymentResult.transaction_id}`
      );
    }

    return;
  }

  if (mode === "checkout-status") {
    const id = process.argv[3];

    if (!id) {
      console.error(
        "Usage: node scripts/picnic-checkout-probe.mjs checkout-status <transactionId>"
      );
      process.exit(1);
    }

    try {
      const result = await send(
        "GET",
        `/cart/checkout/${encodeURIComponent(id)}/status`,
        null,
        false
      );

      print(result);
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data ?? error?.message ?? error;

      if (status === 404 || data === "Not Found") {
        print({
          inactive: true,
          status: "NOT_FOUND",
          meaning: "Transaction is cancelled, expired, or no longer active.",
        });
        return;
      }

      throw error;
    }

    return;
  }

  if (mode === "order-status") {
    const id = process.argv[3];

    if (!id) {
      console.error("Usage: node scripts/picnic-checkout-probe.mjs order-status <orderId>");
      process.exit(1);
    }

    const result = await client.cart.getOrderStatus(id);
    print(result);
    return;
  }

  if (mode === "checkout-cancel") {
    const id = process.argv[3];

    if (!id) {
      console.error(
        "Usage: node scripts/picnic-checkout-probe.mjs checkout-cancel <transactionId>"
      );
      process.exit(1);
    }

    const result = await cancelCheckoutTransaction(id);
    print(result);
    return;
  }

  console.error(`Unknown mode: ${mode}`);
  console.error("");
  console.error("Available modes:");
  console.error("  cart");
  console.error("  slots");
  console.error("  minimum");
  console.error("  payment-profile");
  console.error("  available-payment-methods");
  console.error("  ensure-payment-option <paymentMethod> [bankId|alias]");
  console.error("  ensure-ideal [bankId|alias]");
  console.error("  remove-payment-option <paymentOptionId> --confirm");
  console.error("  checkout-start");
  console.error("  checkout-payment");
  console.error("  checkout-payment-safe");
  console.error("  full-payment-flow [paymentMethod] [bankId|alias] [--keep]");
  console.error("  checkout-status <transactionId>");
  console.error("  order-status <orderId>");
  console.error("  checkout-cancel <transactionId>");
  process.exit(1);
}

main().catch((error) => {
  console.error("FAILED");
  printError(error);
  process.exit(1);
});
