import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "coverage/**",
      ".pnpmfile.cjs",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
  {
    // Widgets use the shared styled controls in packages/react/src/form-controls.tsx, never the browser's own
    // dropdown or date/time pickers, so every screen looks and behaves the same.
    files: ["packages/react/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error",
        { selector: "JSXOpeningElement[name.name='select']", message: "Use Select (or MultiSelect) from ./form-controls instead of a native <select>." },
        { selector: "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value=/^(date|datetime-local|time|month|week)$/]", message: "Use DateField, DateTimeField or TimeField from ./form-controls instead of a native date/time input." },
        { selector: "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'] > JSXExpressionContainer Literal[value=/^(date|datetime-local|time|month|week)$/]", message: "Use DateField, DateTimeField or TimeField from ./form-controls instead of a native date/time input." },
      ],
    },
  },
);
