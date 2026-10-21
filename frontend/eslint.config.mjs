import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Data-fetching pattern used consistently throughout the codebase:
      // async load functions called in useEffect before any await — React 18
      // batches these updates, so cascading renders are not a real concern.
      "react-hooks/set-state-in-effect": "off",
      // logout handlers intentionally use window.location.href for a full
      // page reload to clear all React state and cached auth tokens.
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
]);

export default eslintConfig;
