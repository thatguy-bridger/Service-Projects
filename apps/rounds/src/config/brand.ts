// Rename the app in exactly one place — SPEC.md's cover page: "Working
// name Rounds... Rename in one place — apps/rounds/src/config/brand.ts."
export const brand = {
  productName: "Rounds",
  // Legal entity is one of the three items SPEC.md §22.2 left open and
  // still isn't decided — see docs/rounds/OPEN-QUESTIONS.md. This
  // placeholder shows up anywhere the org's real name would (privacy
  // notice, Stripe Checkout branding) until it's set.
  organizationName: "[ORGANIZATION NAME]",
  defaultTimezone: "America/Denver",
} as const;
