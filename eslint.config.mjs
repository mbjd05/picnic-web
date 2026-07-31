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
]);
