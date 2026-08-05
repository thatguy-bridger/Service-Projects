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

  "dashboard.greeting": "You're signed in as {{role}}.",
  "dashboard.manageUsers.title": "Manage user roles",
  "dashboard.manageUsers.body": "Add someone's email and set their role — it applies the next time they sign in.",
  "dashboard.manageUsers.cta": "Manage users",

  "admin.users.title": "Users",
  "admin.users.subtitle": "Set a role for an email address. If they haven't signed in yet, their first Google sign-in will pick it up.",
  "admin.users.form.email": "Email",
  "admin.users.form.role": "Role",
  "admin.users.form.submit": "Save role",
  "admin.users.form.ownerRestricted": "Only an Owner can grant the Owner role.",
  "admin.users.table.email": "Email",
  "admin.users.table.name": "Name",
  "admin.users.table.role": "Role",
  "admin.users.table.updated": "Last updated",
  "admin.users.empty": "No users yet.",

  "auth.createAccount.cta": "Sign in with email + password",

  "register.title": "Email + password",
  "register.subtitle": "Already have an account with this email? Just enter your password to sign in. New here? This creates your account.",
  "register.form.email": "Email",
  "register.form.password": "Password (10+ characters for a new account)",
  "register.form.confirmPassword": "Confirm password",
  "register.form.confirmPasswordHint": "Only needed if you're creating a new account.",
  "register.form.submit": "Continue",
  "register.form.submitting": "Working…",
  "register.error.mismatch": "Passwords don't match.",
  "register.error.generic": "Something went wrong. Try again.",

  "account.signOut.cta": "Sign out",
  "account.switchAccount.cta": "Switch / add account",

  "landing.imagePlaceholder.caption": "Photos from real events show up here once an organizer adds them",
  "landing.howItWorks.title": "How it works",
  "landing.howItWorks.step1.title": "Find an event",
  "landing.howItWorks.step1.body": "Browse service events an organizer has published near you.",
  "landing.howItWorks.step2.title": "Sign up in minutes",
  "landing.howItWorks.step2.body": "Pick your options, and you're on the list — no account required to browse.",
  "landing.howItWorks.step3.title": "A volunteer handles the rest",
  "landing.howItWorks.step3.body": "Someone from the organizing team takes care of it, and you'll get updates along the way.",

  "preview.label": "View as",
  "preview.real": "Yourself",
  "preview.banner": "Previewing as {{role}} — this doesn't change your real permissions. Any admin actions here still use your real account.",
  "preview.forbidden.title": "Not visible to {{role}}",
  "preview.forbidden.body": "This page is admin-only. A {{role}} account would land somewhere else entirely — this is what that looks like.",

  "signup.address.title": "Where should we set up?",
  "signup.address.subtitle": "Type your address — we'll place an approximate pin. Nudge the coordinates below if it's off.",
  "signup.address.label": "Street address",
  "signup.address.placeholder": "123 Main St, Sandy, UT",
  "signup.address.locating": "Locating…",
  "signup.address.approxPin": "Approximate location found ({{confidence}}% confidence). Adjust below if needed.",
  "signup.address.noPin": "We couldn't place a pin automatically — enter coordinates manually, or continue and a volunteer will confirm in person.",
  "signup.address.lat": "Latitude",
  "signup.address.lng": "Longitude",
  "signup.address.back": "Back",
  "signup.address.continue": "Continue",
  "signup.address.required": "Enter an address to continue.",

  "signup.contact.title": "Almost done",
  "signup.contact.subtitle": "How should we reach you, and anything a volunteer should know?",
  "signup.contact.name": "Full name",
  "signup.contact.email": "Email",
  "signup.contact.phone": "Phone",
  "signup.contact.placementNote": "Where to place the flag",
  "signup.contact.placementNotePlaceholder": "e.g. left of the driveway",
  "signup.contact.accessNotes": "Anything else? (dog, gate code, stairs...)",
  "signup.contact.reviewTitle": "Review",
  "signup.contact.reviewHolidays": "Holidays",
  "signup.contact.reviewAddress": "Address",
  "signup.contact.reviewTotal": "Total",
  "signup.contact.paymentNote": "Payment isn't set up yet — submitting reserves your spot and an organizer will follow up to collect payment.",
  "signup.contact.back": "Back",
  "signup.contact.submit": "Submit",
  "signup.contact.submitting": "Submitting…",
  "signup.contact.required": "Name and address are required.",
  "signup.contact.error": "Something went wrong submitting your signup. Try again.",

  "signup.done.title": "You're on the list",
  "signup.done.body": "We've saved your signup for {{count}} {count, plural, one {holiday} other {holidays}}. An organizer will reach out about payment and details.",
  "signup.done.backHome": "Back to home",

  "dashboard.manageEvents.title": "Events and seasons",
  "dashboard.manageEvents.body": "Generate this year's flag season, or create a one-off event.",
  "dashboard.manageEvents.cta": "Manage events",

  "admin.events.title": "Events",
  "admin.events.currentOrg": "Organization: {{name}}",
  "admin.events.noOrg": "No organization set up yet — creating a season below will create one.",

  "admin.events.generate.title": "Generate this year's flag season",
  "admin.events.generate.subtitle": "Creates the 7 standard holiday events with real calendar dates, matching the public signup page.",
  "admin.events.generate.orgName": "Organization name",
  "admin.events.generate.year": "Year",
  "admin.events.generate.price": "Price per holiday ($)",
  "admin.events.generate.submit": "Generate season",
  "admin.events.generate.submitting": "Generating…",
  "admin.events.generate.success": "Season created.",

  "admin.events.custom.title": "Create a custom event",
  "admin.events.custom.subtitle": "For anything outside the standard flag season — a fundraiser, a flyer delivery, etc.",
  "admin.events.custom.name": "Event name",
  "admin.events.custom.kind": "Kind",
  "admin.events.custom.start": "Starts",
  "admin.events.custom.end": "Ends",
  "admin.events.custom.submit": "Create event",
  "admin.events.custom.submitting": "Creating…",
  "admin.events.custom.success": "Event created.",

  "admin.events.list.title": "Current events",
  "admin.events.list.empty": "No events yet.",
  "admin.events.list.name": "Name",
  "admin.events.list.date": "Date",
  "admin.events.list.status": "Status",
} as const;

export type CopyKey = keyof typeof en;
