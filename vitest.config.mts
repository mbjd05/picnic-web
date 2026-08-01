import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/api/validation.ts",
        "src/lib/auth/session-cookies.ts",
        "src/lib/cart/price-estimates.ts",
        "src/lib/cart/validity.ts",
        "src/lib/cart/wheel-quantity-adjust.ts",
        "src/lib/format/price.ts",
        "src/lib/i18n/localize-api-label.ts",
        "src/lib/payment/options.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
