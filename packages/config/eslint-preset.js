/**
 * Shared ESLint rules for every app. Extend from an app's .eslintrc:
 *   { "extends": ["next/core-web-vitals", "@service-projects/config/eslint-preset"] }
 *
 * The no-restricted-properties block enforces SPEC.md §6: stop, signup,
 * household and visit data is read through a scoped helper in
 * packages/database/src/scoped/, never a raw `prisma.<model>` call in app
 * code — that's what makes "a volunteer can't read another volunteer's
 * stops" an enforced fact instead of a documented intention.
 *
 * Caveat: this is a syntactic rule (no type information), so it matches
 * on the literal identifier `prisma`. `import { prisma as db }` then
 * `db.stop.findMany(...)` would not be caught. Noted in
 * docs/rounds/PHASE-0.md as a known gap, not fixed here — a type-aware
 * rule is real added scope beyond what SPEC.md §6 asked for.
 */
const bannedModel = (property) => ({
  object: "prisma",
  property,
  message: `Use a scoped helper from packages/database/src/scoped instead of prisma.${property} directly — see SPEC.md §6.`,
});

module.exports = {
  rules: {
    "no-restricted-properties": [
      "error",
      bannedModel("stop"),
      bannedModel("signup"),
      bannedModel("household"),
      bannedModel("visit"),
    ],
  },
  overrides: [
    {
      files: ["**/database/src/scoped/**/*.ts"],
      rules: { "no-restricted-properties": "off" },
    },
  ],
};
