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
            {
              group: ["../app/*", "../../app/*", "../../../app/*", "@/app/*"],
              message:
                "App modules are the composition layer. Feature modules must not import from apps/web/src/app.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "apps/web/src/components/**/*.{ts,tsx}",
      "apps/web/src/hooks/**/*.{ts,tsx}",
      "apps/web/src/lib/**/*.{ts,tsx}",
      "apps/web/src/providers/**/*.{ts,tsx}",
      "apps/web/src/stores/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../app/*", "../../app/*", "../../../app/*", "@/app/*"],
              message:
                "App modules are the composition layer. Shared code and features must not import from apps/web/src/app.",
            },
          ],
        },
      ],
    },
  },
]);
