import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "coverage/**"],
  },
  {
    // @react-pdf/renderer's <Image> is a PDF primitive, not a DOM <img>.
    // It has no `alt` prop and the screen-reader rule doesn't apply.
    files: ["src/lib/report/export/pdf*.tsx"],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },
];
