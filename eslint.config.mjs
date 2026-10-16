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
        { selector: "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value=/^(checkbox|radio)$/]", message: "Use Checkbox or Radio from ./form-controls instead of a native checkbox or radio." },
        // A `hidden` file input opened by a styled button is fine; a visible one must be FileInput.
        { selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='hidden'])) > JSXAttribute[name.name='type'][value.value='file']", message: "Use FileInput from ./form-controls instead of a visible native file input." },
      ],
    },
  },
  {
    // The shared controls themselves wrap the native inputs.
    files: ["packages/react/src/form-controls.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
);
