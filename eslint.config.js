const globals = require("globals");

module.exports = [
  {
    ignores: ["_site/**", "node_modules/**"],
  },
  {
    files: [".eleventy.js", "lib/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-dupe-else-if": "error",
      "no-undef": "error",
      "no-unreachable": "error",
    },
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
    rules: {
      "no-constant-binary-expression": "error",
      "no-dupe-else-if": "error",
      "no-undef": "error",
      "no-unreachable": "error",
    },
  },
  {
    files: ["sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.serviceworker,
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-dupe-else-if": "error",
      "no-undef": "error",
      "no-unreachable": "error",
    },
  },
];
