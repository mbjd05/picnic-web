import { describe, expect, it } from "vitest";

import { parseWalletDebts, parseWalletSummaryPage } from "@/lib/parse/wallet";

describe("wallet parser", () => {
  it("extracts the saldo amount and settlement copy from a page tree", () => {
    const summary = parseWalletSummaryPage({
      id: "saldo-balance-page",
      body: {
        children: [
          { markdown: "€0.00" },
          { markdown: "Wordt verrekend met je volgende bestelling." },
        ],
      },
    });

    expect(summary).toEqual({
      balanceCents: 0,
      balanceText: "€0.00",
      settlementText: "Wordt verrekend met je volgende bestelling.",
    });
  });

  it("supports comma decimal balances", () => {
    expect(parseWalletSummaryPage({ markdown: "€12,34" }).balanceCents).toBe(1234);
  });

  it("returns delivery debts from the wallet debts response", () => {
    const debts = parseWalletDebts({
      delivery_debts: [{ delivery_id: "redacted", amount_in_cents: 125 }],
    });

    expect(debts).toEqual([{ delivery_id: "redacted", amount_in_cents: 125 }]);
  });

  it("treats malformed debts as empty", () => {
    expect(parseWalletDebts({ delivery_debts: null })).toEqual([]);
    expect(parseWalletDebts(null)).toEqual([]);
  });
});
