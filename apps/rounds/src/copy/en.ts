/**
 * Flat dotted-key defaults — the "default (in code)" layer of SPEC.md
 * §11.1's resolution order (default -> org override -> event override ->
 * locale -> rendered). Every `t('some.key')` call anywhere in this app
 * must have an entry here; scripts/check-copy-keys.mjs fails the build
 * otherwise. Keys are namespaced by screen, per §11.1.
 *
 * Kept to exactly what the app's UI actually calls — add a key in the
 * same commit as the code that calls it, per SPEC.md §11.1, rather than
 * staging strings ahead of the screens that will use them.
 */
export const en = {
  "brand.name": "Rounds",

  "auth.signIn.cta": "Sign in",

  "previewer.landing.title": "Find a service event near you",
  "previewer.landing.subtitle":
    "Sign in to browse events, or enter a key if someone gave you one.",

  "role.previewer.badge": "Previewer",

  "previewer.emptyState.title": "No events published yet",
  "previewer.emptyState.body":
    "When an organizer publishes an event, it'll show up here. Have an invite key? Look for \"Have a key?\" once events are live.",

  "signup.stepper.holidays": "Holidays",
  "signup.stepper.address": "Address",
  "signup.stepper.pay": "Pay",
  "signup.holidays.title": "Which holidays this year?",
  "signup.holidays.subtitle":
    "Pick as many as you like. A volunteer sets your flag out before sunrise and collects it that evening.",
  "signup.holidays.mostPopular": "Most popular",
  "signup.holidays.selectedCount":
    "{count, plural, one {# holiday selected} other {# holidays selected}}",
  "signup.holidays.continue": "Continue",
  "signup.notFound.title": "Signups aren't open right now",
  "signup.notFound.body": "Check back soon, or ask your organizer for the current signup link.",
} as const;

export type CopyKey = keyof typeof en;
