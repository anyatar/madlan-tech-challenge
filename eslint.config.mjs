import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Hebrew abbreviations (מ"ר, ממ"ד) use a plain quote mark; React renders it fine, and &quot; would hide the word.
      "react/no-unescaped-entities": "off",
      // `const { a: _, ...rest } = obj` drops a key on purpose.
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
]);
