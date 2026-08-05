// A scoped-package `extends` (e.g. "@service-projects/config/eslint-preset")
// doesn't resolve reliably through `next lint`'s bundled ESLint resolver in
// this monorepo, so the shared preset is pulled in with a plain relative
// require instead — the most robust option regardless of module
// resolution quirks.
const preset = require("../../packages/config/eslint-preset");

module.exports = {
  extends: ["next/core-web-vitals"],
  rules: preset.rules,
  overrides: preset.overrides,
};
