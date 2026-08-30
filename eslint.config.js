const js = require("@eslint/js");
const globals = require("globals");

/* eslint:recommended everywhere, with the handful of adjustments this
 * codebase needs: empty catch blocks are the normal "best effort, degrade
 * quietly" idiom here, and unused function arguments are allowed when they
 * document a callback's shape (prefix with _ to skip the check). */
const sharedRules = {
  ...js.configs.recommended.rules,
  "no-constant-binary-expression": "error",
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-unused-vars": ["error", {
    args: "none",
    caughtErrors: "none",
    varsIgnorePattern: "^_",
  }],
};

module.exports = [
  {
    ignores: ["_site/**", "node_modules/**"],
  },
  {
    files: [".eleventy.js", "lib/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: sharedRules,
  },
  {
    files: ["src/js/**/*.js", "scripts/build-js.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        PagefindUI: "readonly",
      },
    },
    rules: sharedRules,
  },
  {
    files: ["sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.serviceworker,
    },
    rules: sharedRules,
  },
];
