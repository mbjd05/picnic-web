import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "dist/**",
    "apps/**/dist/**",
    "apps/**/.wrangler/**",
    "build/**",
    "coverage/**",
    "**/*.min.js",
  ]),
  ...tseslint.config({
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {},
  }),
  {
    files: ["apps/web/src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "../auth/*",
                "../browsing/*",
                "../cart/*",
                "../deliveries/*",
                "../payment/*",
                "../products/*",
                "../recipes/*",
                "../shell/*",
              ],
              message:
                "Feature modules should not import sibling features directly. Move shared code to apps/web/src/components, hooks, stores, or src/lib.",
            },
          ],
        },
      ],
    },
  },
]);
