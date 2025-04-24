import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Add custom rule configuration for TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"], // Target TS/TSX files
    rules: {
      // Configure the TS version of no-unused-vars
      "@typescript-eslint/no-unused-vars": [
        "warn", // Or "error" if you prefer
        {
          "argsIgnorePattern": "^_", // Ignore args starting with _
          "varsIgnorePattern": "^_", // Optionally ignore variables starting with _
          "caughtErrorsIgnorePattern": "^_" // Optionally ignore caught errors starting with _
        }
      ]
    }
  }
];

export default eslintConfig;
