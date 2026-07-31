import { describe, expect, it } from "vitest";

import { formatEuroPrice, formatPrice } from "@/lib/format-price";

describe("price formatting", () => {
  it("formats cents without a currency symbol for compact product prices", () => {
    expect(formatPrice(0)).toBe("0.00");
    expect(formatPrice(149)).toBe("1.49");
    expect(formatPrice(4500)).toBe("45.00");
  });

  it("formats euro messages with a euro sign and comma decimal separator", () => {
    expect(formatEuroPrice(0)).toBe("€0,00");
    expect(formatEuroPrice(149)).toBe("€1,49");
    expect(formatEuroPrice(4500)).toBe("€45,00");
  });
});
