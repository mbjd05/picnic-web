````markdown
# Picnic Direct Checkout + Payment Profile Spec

## Scope

This spec documents the discovered Picnic API flow needed to support:

1. an account settings tab for payment method setup;
2. storing and removing account-level payment options;
3. using a stored payment option as the account’s preferred payment option;
4. direct checkout from a web client;
5. extraction and use of the direct payment redirect URL;
6. safe cancellation of initiated checkout/payment transactions.

The implementation must read payment profile data dynamically. iDEAL | Wero is the only confirmed payment-method setup flow in this project because it has only been tested with an NL account. Do not invent iDEAL availability client-side: expose setup only when `available_payment_methods` from Picnic contains `payment_method: "IDEAL"`.

Other Picnic regions and payment methods may still be readable from `GET /payment-profile`, and checkout may work for accounts that already have a preferred payment option in their Picnic region. Creating or replacing non-iDEAL payment options remains unsupported until an authenticated account in that region confirms the request/response flow.

Important naming note: the iDEAL option currently appears with display name:

```text
iDEAL | Wero
```

This is the newer/correct display label, because iDEAL is transitioning toward Wero branding. The API still uses:

```text
payment_method: "IDEAL"
```

The findings are based on live probing with `picnic-api` and an existing Next.js client/server architecture.

---

## Confirmed API context

The `picnic-api` client is instantiated as:

```js
const client = new PicnicClient({
  countryCode: "NL",
  apiVersion: "17",
  authKey: token,
});
```

The API base used by the client is effectively:

```text
https://storefront-prod.nl.picnicinternational.com/api/17
```

All sensitive Picnic API calls must remain server-side. The browser must never receive or store the Picnic auth token.

---

## `sendRequest` behavior

The package call pattern is:

```js
client.sendRequest(method, path, body, includeFusion);
```

Observed implementation:

```js
client.payment.getPaymentProfile();
```

is implemented as:

```js
getPaymentProfile() {
  return this.http.sendRequest("GET", `/payment-profile`, null, true);
}
```

Therefore the correct payment profile route is:

```http
GET /payment-profile
```

with:

```js
includeFusion = true;
```

The following route was tested and is wrong:

```http
GET /payment/profile
```

It returned:

```text
Not Found
```

---

## Route summary

| Purpose                             | Method | Picnic route                                           | includeFusion |
| ----------------------------------- | -----: | ------------------------------------------------------ | ------------: |
| Read payment profile                |    GET | `/payment-profile`                                     |        `true` |
| Create/store payment option         |   POST | `/payment-profile/payment-options`                     |        `true` |
| Remove stored payment option        | DELETE | `/payment-profile/payment-options/{payment_option_id}` |        `true` |
| Start checkout                      |   POST | `/cart/checkout/start`                                 |        `true` |
| Initiate payment                    |   POST | `/cart/checkout/initiate_payment`                      |        `true` |
| Cancel checkout/payment transaction |   POST | `/cart/checkout/cancel`                                |        `true` |
| Read checkout status                |    GET | `/cart/checkout/{transaction_id}/status`               |       `false` |

---

## Payment profile

### Route

```http
GET /payment-profile
```

### Call

```js
const profile = await client.sendRequest("GET", "/payment-profile", null, true);
```

or:

```js
const profile = await client.payment.getPaymentProfile();
```

### Response before setting a payment option

Example:

```json
{
  "stored_payment_options": [],
  "available_payment_methods": [
    {
      "payment_method": "IDEAL",
      "available_banks": [
        {
          "bank_id": "ASNBNL21",
          "name": "ASN Bank"
        }
      ]
    },
    {
      "payment_method": "MAESTRO",
      "available_banks": [
        {
          "bank_id": "RABONL2U",
          "name": "Rabobank"
        }
      ]
    }
  ],
  "payment_methods": [
    {
      "payment_method": "IDEAL",
      "display_name": "iDEAL | Wero",
      "icon_url": "https://...",
      "brands": [],
      "data": {},
      "visibility": "SHOWN",
      "visibility_reason": null
    },
    {
      "payment_method": "MAESTRO",
      "display_name": "Maestro-betaalpas",
      "icon_url": "https://...",
      "brands": [
        {
          "brand": "RABONL2U",
          "display_name": "Rabobank",
          "icon_url": "https://..."
        }
      ],
      "data": {},
      "visibility": "SHOWN",
      "visibility_reason": null
    }
  ],
  "preferred_payment_option_id": null,
  "available_payment_method_item": null,
  "checkout_banner": null
}
```

### Response after storing iDEAL / Wero

Example:

```json
{
  "stored_payment_options": [
    {
      "id": "0e429867-475a-4d42-94af-7761f8b52f14",
      "payment_method": "IDEAL",
      "brand": null,
      "account": null,
      "display_name": "iDEAL | Wero",
      "icon_url": "https://..."
    }
  ],
  "available_payment_methods": [
    {
      "payment_method": "MAESTRO",
      "available_banks": [
        {
          "bank_id": "RABONL2U",
          "name": "Rabobank"
        }
      ]
    }
  ],
  "payment_methods": [
    {
      "payment_method": "MAESTRO",
      "display_name": "Maestro-betaalpas",
      "icon_url": "https://...",
      "brands": [
        {
          "brand": "RABONL2U",
          "display_name": "Rabobank",
          "icon_url": "https://..."
        }
      ],
      "data": {},
      "visibility": "SHOWN",
      "visibility_reason": null
    }
  ],
  "preferred_payment_option_id": "0e429867-475a-4d42-94af-7761f8b52f14",
  "available_payment_method_item": null,
  "checkout_banner": null
}
```

### Interpretation

`stored_payment_options` contains already-created account-level payment options.

`preferred_payment_option_id` must be non-null before payment initiation works.

If `preferred_payment_option_id` is `null`, then:

```http
POST /cart/checkout/initiate_payment
```

fails with:

```text
User with user_id='...' has no preferred option
```

Passing `payment_method`, `bank_id`, `issuer_id`, `payment_option`, `payment_method_data`, or `data` directly to `/cart/checkout/initiate_payment` did not bypass this requirement. Picnic checks account-level preferred payment state first.

---

## Payment profile type model

Use a generic model. Do not model this as iDEAL-only.

```ts
type PaymentBank = {
  bank_id: string;
  name: string;
};

type AvailablePaymentMethod = {
  payment_method: string;
  available_banks?: PaymentBank[];
};

type PaymentBrand = {
  brand: string;
  display_name?: string;
  icon_url?: string;
};

type PaymentMethod = {
  payment_method: string;
  display_name?: string;
  icon_url?: string;
  brands?: PaymentBrand[];
  data?: Record<string, unknown>;
  visibility?: string;
  visibility_reason?: string | null;
};

type StoredPaymentOption = {
  id: string;
  payment_method: string;
  brand?: string | null;
  account?: string | null;
  display_name?: string;
  icon_url?: string;
};

type PaymentProfile = {
  stored_payment_options?: StoredPaymentOption[];
  available_payment_methods?: AvailablePaymentMethod[];
  payment_methods?: PaymentMethod[];
  preferred_payment_option_id?: string | null;
  available_payment_method_item?: unknown | null;
  checkout_banner?: unknown | null;
};
```

---

## Available bank IDs

Discovered from `GET /payment-profile`.

For iDEAL / Wero, observed available banks included:

```json
[
  { "bank_id": "ABNANL2A", "name": "ABN AMRO" },
  { "bank_id": "ASNBNL21", "name": "ASN Bank" },
  { "bank_id": "BUNQNL2A", "name": "bunq" },
  { "bank_id": "INGBNL2A", "name": "ING" },
  { "bank_id": "KNABNL2H", "name": "Knab" },
  { "bank_id": "RABONL2U", "name": "Rabobank" },
  { "bank_id": "RBRBNL21", "name": "RegioBank" },
  { "bank_id": "SNSBNL2A", "name": "SNS" },
  { "bank_id": "TRIONL2U", "name": "Triodos Bank" },
  { "bank_id": "FVLBNL22", "name": "Van Lanschot" },
  { "bank_id": "REVOLT21", "name": "Revolut" },
  { "bank_id": "NTSBDEB1", "name": "N26" },
  { "bank_id": "NNBANL2G", "name": "NN" },
  { "bank_id": "BITSNL2A", "name": "Yoursafe" },
  { "bank_id": "ADYBNL2A", "name": "Adyen" },
  { "bank_id": "FNOMNL22", "name": "Finom" },
  { "bank_id": "BUUTNL2A", "name": "BUUT" }
]
```

For ASN Bank:

```text
ASNBNL21
```

Other payment methods can also expose `available_banks`. For example, `MAESTRO` was observed with Rabobank:

```json
{
  "payment_method": "MAESTRO",
  "available_banks": [
    {
      "bank_id": "RABONL2U",
      "name": "Rabobank"
    }
  ]
}
```

Confirmed:

- `IDEAL` with `bank_id: "ASNBNL21"` works through `/payment-profile/payment-options`.

Likely/generalized:

- The endpoint appears to accept a generic `payment_method` plus optional `bank_id`.
- Other methods exposed in `available_payment_methods`, such as `MAESTRO`, should be presented dynamically but marked as unverified until tested.

---

## Store payment option

### Confirmed working route

```http
POST /payment-profile/payment-options
```

This creates a stored payment option and makes it preferred.

### Body shape

Generic body:

```json
{
  "payment_method": "IDEAL",
  "bank_id": "ASNBNL21"
}
```

For iDEAL / Wero with ASN Bank:

```json
{
  "payment_method": "IDEAL",
  "bank_id": "ASNBNL21"
}
```

For other methods, use the dynamic `payment_method` and `bank_id` values exposed by `GET /payment-profile`.

### Call

```js
await client.sendRequest(
  "POST",
  "/payment-profile/payment-options",
  {
    payment_method: selectedPaymentMethod,
    bank_id: selectedBankId,
  },
  true
);
```

For some future method, `bank_id` may be optional. The implementation should not assume every method has banks, but should include `bank_id` when the selected method exposes `available_banks`.

### Important response handling

This route appears to return an empty body on success.

The current `picnic-api` wrapper may throw:

```text
Unexpected end of JSON input
```

because it tries to parse an empty response as JSON.

Live probing showed that after this apparent failure, a new iDEAL option was added and became the preferred payment option:

```json
{
  "stored_payment_options": [
    {
      "id": "0e429867-475a-4d42-94af-7761f8b52f14",
      "payment_method": "IDEAL",
      "display_name": "iDEAL | Wero"
    },
    {
      "id": "026593f0-b1f5-4571-9654-19393b1697c0",
      "payment_method": "IDEAL",
      "display_name": "iDEAL | Wero"
    }
  ],
  "preferred_payment_option_id": "026593f0-b1f5-4571-9654-19393b1697c0"
}
```

Therefore the mutation response body must not be trusted. Always verify by re-reading the payment profile.

### Correct processing rule

1. Call `GET /payment-profile`.
2. Determine whether the current `preferred_payment_option_id` points to a stored option matching the desired `payment_method`.
3. If it already matches, do nothing.
4. If no matching preferred option exists, check whether the desired method is available in `available_payment_methods`.
5. If the method exposes `available_banks`, require a valid `bank_id`.
6. Call `POST /payment-profile/payment-options`.
7. If the POST succeeds, continue.
8. If the POST throws `Unexpected end of JSON input`, treat it as possibly successful.
9. Immediately call `GET /payment-profile`.
10. Treat the operation as successful if:
    - `preferred_payment_option_id` is non-null; and
    - `preferred_payment_option_id` points to a stored option with the desired `payment_method`.

For iDEAL / Wero, the desired method is still:

```text
IDEAL
```

The user-facing display label should be:

```text
iDEAL | Wero
```

when returned by the API.

### Idempotency warning

Do not call `POST /payment-profile/payment-options` blindly on every checkout.

Repeated calls can create duplicate stored payment options. First read `GET /payment-profile` and create a new option only when no usable preferred option exists.

---

## Remove stored payment option

### Confirmed working route

```http
DELETE /payment-profile/payment-options/{payment_option_id}
```

### Call

```js
await client.sendRequest(
  "DELETE",
  `/payment-profile/payment-options/${encodeURIComponent(paymentOptionId)}`,
  null,
  true
);
```

### Important response handling

This route appears to return an empty body on success.

The current `picnic-api` wrapper may throw:

```text
Unexpected end of JSON input
```

because it tries to parse an empty response as JSON.

Live probing confirmed that after this apparent failure, the selected stored payment option was removed from:

```http
GET /payment-profile
```

### Correct processing rule

1. Call `GET /payment-profile`.
2. Confirm the target `paymentOptionId` exists in `stored_payment_options`.
3. Call `DELETE /payment-profile/payment-options/{payment_option_id}`.
4. If the DELETE succeeds, continue.
5. If the DELETE throws `Unexpected end of JSON input`, treat it as possibly successful.
6. Immediately call `GET /payment-profile`.
7. Treat removal as successful if the target option ID is no longer present in `stored_payment_options`.

### Safety rule

Only remove one explicit payment option ID at a time.

Do not remove the currently preferred option unless the user explicitly intends to clear or replace the active payment method. Removing the preferred option may make checkout fail again until a new preferred payment option is created.

### Recommended robust implementation

```ts
async function removePaymentOption(client, paymentOptionId: string): Promise<PaymentProfile> {
  const before = await getPaymentProfile(client);

  const existsBefore = before.stored_payment_options?.some(
    (option) => option.id === paymentOptionId
  );

  if (!existsBefore) {
    throw new Error(`Payment option does not exist: ${paymentOptionId}`);
  }

  try {
    await client.sendRequest(
      "DELETE",
      `/payment-profile/payment-options/${encodeURIComponent(paymentOptionId)}`,
      null,
      true
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("Unexpected end of JSON input")) {
      throw error;
    }

    // Empty response body may indicate success.
    // Verify by re-reading the profile below.
  }

  const after = await getPaymentProfile(client);

  const stillExists = after.stored_payment_options?.some((option) => option.id === paymentOptionId);

  if (stillExists) {
    throw new Error(`Payment option still exists after DELETE: ${paymentOptionId}`);
  }

  return after;
}
```

---

## Unknown / not yet discovered

A dedicated endpoint for selecting one existing stored payment option by `id` was not discovered.

The confirmed working path for changing the preferred option is creating a new payment option via:

```http
POST /payment-profile/payment-options
```

That operation also made the new option preferred.

Existing-option switching should not be implemented unless a separate endpoint is discovered.

---

## Routes tested and rejected for setting payment profile

These routes/methods were tested and should not be used:

```http
POST /payment-profile
PUT /payment-profile
PATCH /payment-profile
POST /payment-profile/stored-payment-options
POST /payment-profile/preferred-payment-option
PUT /payment-profile/preferred-payment-option
```

Observed responses included:

```text
405 METHOD_NOT_ALLOWED "Request method 'POST' is not supported."
405 METHOD_NOT_ALLOWED "Request method 'PUT' is not supported."
405 METHOD_NOT_ALLOWED "Request method 'PATCH' is not supported."
Not Found
```

The only route with a clear side effect for creation was:

```http
POST /payment-profile/payment-options
```

The confirmed route for removal is:

```http
DELETE /payment-profile/payment-options/{payment_option_id}
```

---

## Checkout start

### Route

```http
POST /cart/checkout/start
```

### Body

```json
{
  "mts": 1779285330422,
  "oos_article_ids": null
}
```

### Call

```js
const cart = await client.cart.getCart();

const checkout = await client.sendRequest(
  "POST",
  "/cart/checkout/start",
  {
    mts: cart.mts,
    oos_article_ids: null,
  },
  true
);
```

### Important response fields

```json
{
  "order_id": "609-071-1801",
  "transaction_expiry": "2026-05-20T14:05:55.968Z",
  "address": {},
  "delivery_slots": [
    {
      "slot_id": "69f14a0ef7feef736a763f0e",
      "selected": true,
      "reserved": true,
      "minimum_order_value": 4500
    }
  ],
  "coupon_code": {},
  "total_count": 21,
  "total_price": 4662,
  "total_deposit": 39,
  "total_savings": 108,
  "advice": [],
  "deposit_breakdown": [
    {
      "type": "BAG",
      "value": 39,
      "count": 1
    }
  ]
}
```

`order_id` is required for payment initiation.

`transaction_expiry` can be used for UI state and timeout handling.

`delivery_slots` includes selected and available slots. The selected slot should have:

```json
{
  "selected": true,
  "reserved": true
}
```

### Important errors

If cart is below the minimum order value:

```text
Dit bezorgmoment is beschikbaar vanaf €45. Altijd gratis bezorgd :)
```

If cart/checkouts are stale:

```text
Your shopping cart is out of date
```

Processing rule for stale cart:

1. re-fetch cart;
2. ensure slot is still selected/reserved;
3. optionally make a harmless cart update if state remains stuck;
4. retry checkout start with fresh `cart.mts`.

---

## Checkout initiate payment

### Route

```http
POST /cart/checkout/initiate_payment
```

### Body

```json
{
  "order_id": "609-071-1801",
  "app_return_url": "http://localhost:3000/cart/payment-return"
}
```

### Call

```js
const payment = await client.sendRequest(
  "POST",
  "/cart/checkout/initiate_payment",
  {
    order_id: checkout.order_id,
    app_return_url: appReturnUrl,
  },
  true
);
```

### Preconditions

Account must have:

```json
{
  "preferred_payment_option_id": "..."
}
```

If no preferred option exists, the route fails with:

```text
User with user_id='...' has no preferred option
```

### Do not pass payment selection parameters here

Do not pass any of the following to `/cart/checkout/initiate_payment`:

```json
{
  "payment_method": "IDEAL",
  "bank_id": "ASNBNL21",
  "issuer_id": "ASNBNL21",
  "payment_option": {},
  "payment_method_data": {},
  "data": {}
}
```

These were tested and did not bypass the account-level preferred payment requirement.

Once a preferred payment option exists, `initiate_payment` should be called with only:

```json
{
  "order_id": "...",
  "app_return_url": "..."
}
```

### Successful response structure

```json
{
  "payment_id": "cd5cc45c-42d8-47f3-8c13-4440d11c727a",
  "transaction_id": "3ecefbb6-70df-4ce3-bf6c-4fcdb026588d",
  "issuer_authentication_url": "https://checkout.buckaroo.nl/html/redirect.ashx?r=...",
  "action": {
    "type": "REDIRECT",
    "redirect_url": "https://checkout.buckaroo.nl/html/redirect.ashx?r=..."
  }
}
```

The web client should use:

```js
payment.action.redirect_url;
```

as the primary redirect URL.

Fallback:

```js
payment.issuer_authentication_url;
```

Use:

```js
const redirectUrl = payment?.action?.redirect_url ?? payment?.issuer_authentication_url ?? null;
```

The live successful response confirmed that `action.type` is `REDIRECT` and that the redirect URL points to Buckaroo checkout.

### Client-facing server response

The server should return only the fields needed by the browser:

```json
{
  "orderId": "609-071-1801",
  "paymentId": "cd5cc45c-42d8-47f3-8c13-4440d11c727a",
  "transactionId": "3ecefbb6-70df-4ce3-bf6c-4fcdb026588d",
  "redirectUrl": "https://checkout.buckaroo.nl/html/redirect.ashx?r=...",
  "transactionExpiry": "2026-05-20T14:05:55.968Z"
}
```

Frontend processing:

```ts
sessionStorage.setItem("picnic_checkout_transaction_id", transactionId);
sessionStorage.setItem("picnic_checkout_order_id", orderId);
window.open(redirectUrl, "_blank", "noopener,noreferrer");
```

Opening in a new tab is preferred for this web-client implementation so the original cart/app state remains available.

---

## Checkout cancel

### Route

```http
POST /cart/checkout/cancel
```

### Body

```json
{
  "transaction_id": "3ecefbb6-70df-4ce3-bf6c-4fcdb026588d"
}
```

### Call

```js
await client.sendRequest(
  "POST",
  "/cart/checkout/cancel",
  {
    transaction_id: transactionId,
  },
  true
);
```

### Correct ID to use

Use:

```text
transaction_id
```

Do not use:

```text
payment_id
order_id
```

### Successful response

The wrapper/probe returned:

```json
{
  "ok": true
}
```

This indicates the cancellation worked.

### Status after cancel

Calling:

```http
GET /cart/checkout/{transaction_id}/status
```

after cancellation returned:

```text
Not Found
```

Processing rule:

- after `checkout-cancel` returns success, treat the transaction as cancelled;
- if status returns `404 Not Found`, treat it as “cancelled or no longer active,” not necessarily as an error.

---

## Checkout status

### Route

```http
GET /cart/checkout/{transaction_id}/status
```

### Call

```js
const status = await client.sendRequest(
  "GET",
  `/cart/checkout/${encodeURIComponent(transactionId)}/status`,
  null,
  false
);
```

### Observed behavior

After successful cancellation, this route returned:

```text
Not Found
```

So status is useful while payment is pending, but `404` after cancel should be handled as an inactive/cancelled transaction.

---

## Account settings tab requirements

### Server-side API routes

Add:

```text
GET    /api/account/payment-profile
POST   /api/account/payment-profile/payment-options
DELETE /api/account/payment-profile/payment-options/{paymentOptionId}
```

Optional helper routes:

```text
POST /api/checkout/start-payment
POST /api/checkout/cancel
GET  /api/checkout/status/[transactionId]
```

### Account payment UI

The Account tab should be data-driven from `GET /payment-profile`.

It should display:

1. current preferred payment option;
2. stored payment options;
3. available payment methods;
4. available banks/brands for the selected method when provided;
5. an action to create/use the selected payment option;
6. an action to remove an explicitly selected stored payment option.

Read the available methods from `GET /payment-profile`. The current web client may create/update only confirmed iDEAL | Wero options, and only when Picnic returns `payment_method: "IDEAL"` in `available_payment_methods`.

For iDEAL, display the API-provided label:

```text
iDEAL | Wero
```

when present.

### Payment profile UI interpretation

If:

```json
"preferred_payment_option_id": null
```

show:

```text
Geen standaard betaalmethode ingesteld.
```

If the confirmed supported method contains `available_banks`, show a bank picker. Do not use a built-in fallback bank list when the API omits the method or bank list.

If `stored_payment_options` contains the preferred option, show:

```text
Standaard: {display_name}
```

For iDEAL / Wero this is expected to show:

```text
Standaard: iDEAL | Wero
```

If iDEAL | Wero is absent, show a clear unsupported account/region message instead of a setup form. This is expected for unverified regions such as DE/FR until their payment profile shape and mutation flow are captured with region-local test accounts.

### ASN action example

For ASN Bank with iDEAL / Wero:

```json
{
  "payment_method": "IDEAL",
  "bank_id": "ASNBNL21"
}
```

### Recommended create/update backend route

```ts
export async function POST(request: NextRequest) {
  const { paymentMethod, bankId } = await request.json();

  const before = await client.sendRequest("GET", "/payment-profile", null, true);

  const alreadyPreferred = before.stored_payment_options?.some(
    (option) =>
      option.id === before.preferred_payment_option_id && option.payment_method === paymentMethod
  );

  if (alreadyPreferred) {
    return NextResponse.json(before);
  }

  const availableMethod = before.available_payment_methods?.find(
    (method) => method.payment_method === paymentMethod
  );

  if (!availableMethod) {
    return NextResponse.json(
      { error: "Selected payment method is not available." },
      { status: 400 }
    );
  }

  if (
    availableMethod.available_banks?.length &&
    !availableMethod.available_banks.some((bank) => bank.bank_id === bankId)
  ) {
    return NextResponse.json(
      { error: "Selected bank is not available for this payment method." },
      { status: 400 }
    );
  }

  const body = bankId
    ? { payment_method: paymentMethod, bank_id: bankId }
    : { payment_method: paymentMethod };

  try {
    await client.sendRequest("POST", "/payment-profile/payment-options", body, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("Unexpected end of JSON input")) {
      throw error;
    }
  }

  const after = await client.sendRequest("GET", "/payment-profile", null, true);

  return NextResponse.json(after);
}
```

### Recommended remove backend route

```ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ paymentOptionId: string }> }
) {
  const { paymentOptionId } = await params;

  const before = await client.sendRequest("GET", "/payment-profile", null, true);

  const existsBefore = before.stored_payment_options?.some(
    (option) => option.id === paymentOptionId
  );

  if (!existsBefore) {
    return NextResponse.json({ error: "Payment option does not exist." }, { status: 404 });
  }

  try {
    await client.sendRequest(
      "DELETE",
      `/payment-profile/payment-options/${encodeURIComponent(paymentOptionId)}`,
      null,
      true
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("Unexpected end of JSON input")) {
      throw error;
    }
  }

  const after = await client.sendRequest("GET", "/payment-profile", null, true);

  const stillExists = after.stored_payment_options?.some((option) => option.id === paymentOptionId);

  if (stillExists) {
    return NextResponse.json(
      { error: "Payment option still exists after delete." },
      { status: 502 }
    );
  }

  return NextResponse.json(after);
}
```

### UI success conditions

After POST, reload profile and verify:

```ts
const preferredOption = profile.stored_payment_options?.find(
  (option) =>
    option.id === profile.preferred_payment_option_id &&
    option.payment_method === selectedPaymentMethod
);

const success = Boolean(preferredOption);
```

After DELETE, reload profile and verify:

```ts
const removed = !profile.stored_payment_options?.some(
  (option) => option.id === removedPaymentOptionId
);
```

---

## Checkout/payment route requirements for web app

### Server endpoint: start payment

Suggested route:

```text
POST /api/checkout/start-payment
```

Internal flow:

```ts
const cart = await client.cart.getCart();

const checkout = await client.sendRequest(
  "POST",
  "/cart/checkout/start",
  {
    mts: cart.mts,
    oos_article_ids: null,
  },
  true
);

const payment = await client.sendRequest(
  "POST",
  "/cart/checkout/initiate_payment",
  {
    order_id: checkout.order_id,
    app_return_url: appReturnUrl,
  },
  true
);

const redirectUrl = payment?.action?.redirect_url ?? payment?.issuer_authentication_url ?? null;

return {
  orderId: checkout.order_id,
  paymentId: payment.payment_id,
  transactionId: payment.transaction_id,
  redirectUrl,
  transactionExpiry: checkout.transaction_expiry,
};
```

### Error mapping

If error contains:

```text
has no preferred option
```

return:

```json
{
  "code": "NO_PREFERRED_PAYMENT_OPTION",
  "error": "Er is nog geen voorkeursbetaalmethode ingesteld. Ga naar Account > Betaling en kies een betaalmethode."
}
```

If error contains:

```text
Your shopping cart is out of date
```

return:

```json
{
  "code": "CART_OUT_OF_DATE",
  "error": "Je winkelwagen is niet meer actueel. Ververs de winkelwagen en probeer opnieuw."
}
```

If error contains the minimum order warning, return:

```json
{
  "code": "MINIMUM_ORDER_VALUE",
  "error": "Dit bezorgmoment is beschikbaar vanaf €45."
}
```

---

## Return URL handling

`app_return_url` was accepted as:

```text
http://localhost:3000/cart/payment-return
```

Payment initiation returned a Buckaroo redirect URL. The web client can send the user to that URL directly.

The return page should:

1. read `transactionId` and `orderId` from `sessionStorage`;
2. call the server-side checkout status route;
3. show pending/success/failure;
4. offer cancel or retry if pending/failure.

---

## Confirmed successful end-to-end flow

1. `GET /payment-profile`.
2. If no preferred option exists for the selected method:
   ```http
   POST /payment-profile/payment-options
   ```
   with, for iDEAL / Wero + ASN:
   ```json
   {
     "payment_method": "IDEAL",
     "bank_id": "ASNBNL21"
   }
   ```
3. Re-read `GET /payment-profile`.
4. Verify a preferred option exists for the selected method.
5. `POST /cart/checkout/start`.
6. Extract `order_id`.
7. `POST /cart/checkout/initiate_payment`.
8. Extract:
   ```js
   payment.action.redirect_url ?? payment.issuer_authentication_url;
   ```
9. Open Buckaroo payment URL in a new tab.
10. For cancellation/testing, call:
    ```http
    POST /cart/checkout/cancel
    ```
    with:
    ```json
    {
      "transaction_id": "..."
    }
    ```

---

## Confirmed payment-option cleanup flow

1. `GET /payment-profile`.
2. Pick one explicit `stored_payment_options[].id`.
3. Call:
   ```http
   DELETE /payment-profile/payment-options/{payment_option_id}
   ```
4. If the wrapper throws `Unexpected end of JSON input`, treat it as possibly successful.
5. Re-read `GET /payment-profile`.
6. Verify the removed ID is no longer present.

---

## Current verification status

Confirmed by live probing:

- `GET /payment-profile`
- `POST /payment-profile/payment-options` with `payment_method: "IDEAL"` and `bank_id: "ASNBNL21"`
- `DELETE /payment-profile/payment-options/{payment_option_id}`
- `POST /cart/checkout/start`
- `POST /cart/checkout/initiate_payment`
- extraction of `action.redirect_url`
- `POST /cart/checkout/cancel`

Not yet confirmed:

- Creating/storing non-iDEAL payment methods through `/payment-profile/payment-options`
- Selecting one existing stored payment option by `id`
- Full post-payment return/status success state after completing real iDEAL/Wero payment
````
