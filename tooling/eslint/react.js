import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const reactHooksPlugin =
  /** @type {{ configs?: { recommended?: { rules?: Record<string, unknown> } | { rules?: Record<string, unknown> }[] } }} */ (
    reactHooks
  );
const reactHooksRecommended = reactHooksPlugin.configs?.recommended;
const reactHooksRules = /** @type {import("eslint").Linter.RulesRecord} */ (
  reactHooksRecommended && !Array.isArray(reactHooksRecommended)
    ? (reactHooksRecommended.rules ?? {})
    : {}
);

/** @type {Awaited<import('typescript-eslint').Config>} */
export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooksRules,
      ...reactPlugin.configs["jsx-runtime"].rules,
    },
    languageOptions: {
      globals: {
        React: "writable",
      },
    },
  },
];
