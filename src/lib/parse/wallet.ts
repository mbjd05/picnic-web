import type { WalletDebt, WalletSummary } from "@/types/payment";

const EURO_AMOUNT_PATTERN = /€\s*(-?\d+(?:[.,]\d{2})?)/;

export function parseWalletSummaryPage(rawPage: unknown): Pick<
  WalletSummary,
  "balanceCents" | "balanceText" | "settlementText"
> {
  const markdownValues = collectMarkdownValues(rawPage);
  const balanceText = markdownValues.find((value) => EURO_AMOUNT_PATTERN.test(value)) ?? null;
  const balanceCents = balanceText ? parseEuroAmount(balanceText) : null;
  const settlementText =
    markdownValues.find((value) => /verrekend|settled|verrechnet|déduit/i.test(value)) ?? null;

  return {
    balanceCents,
    balanceText,
    settlementText,
  };
}

export function parseWalletDebts(rawDebts: unknown): WalletDebt[] {
  if (!isRecord(rawDebts)) return [];
  const deliveryDebts = rawDebts["delivery_debts"];
  return Array.isArray(deliveryDebts) ? (deliveryDebts.filter(isRecord) as WalletDebt[]) : [];
}

function collectMarkdownValues(value: unknown): string[] {
  if (typeof value === "string") return [];
  if (Array.isArray(value)) return value.flatMap(collectMarkdownValues);
  if (!isRecord(value)) return [];

  const current = typeof value["markdown"] === "string" ? [value["markdown"]] : [];
  return [...current, ...Object.values(value).flatMap(collectMarkdownValues)];
}

function parseEuroAmount(value: string): number | null {
  const match = value.match(EURO_AMOUNT_PATTERN);
  if (!match) return null;

  const normalized = match[1].replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
