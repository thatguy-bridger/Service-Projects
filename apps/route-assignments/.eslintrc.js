// See apps/rounds/.eslintrc.js for why this is a relative require rather
// than an `extends: "@service-projects/config/eslint-preset"` entry.
const preset = require("../../packages/config/eslint-preset");

module.exports = {
  extends: ["next/core-web-vitals"],
  rules: preset.rules,
  overrides: preset.overrides,
};
