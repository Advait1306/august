import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["drizzle/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2021 },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
