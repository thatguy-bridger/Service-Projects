import { notFound } from "next/navigation";
import { defaultOrganization, copyOverridesForOrg } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { en } from "@/copy";
import { CopyOverridesClient } from "./CopyOverridesClient";

// SPEC.md §11.1/§21 Phase 8: the copy editor's storage + admin UI half.
// Scoped down deliberately -- see UiCopyOverride's schema comment and
// packages/database/src/scoped/copyOverrides.ts. Every key in en.ts (the
// code-default layer) is listed here whether or not it's overridden, so
// an admin can browse/search everything the app actually says, not just
// what's already been changed.
//
// Not done in this pass: making a saved override actually change what
// visitors see. Every current `t()` call site imports one module-level
// singleton built from empty overrides -- wiring per-request, org-scoped
// resolution through every screen that calls it is a real, separate
// piece of work (touches dozens of files), not attempted here. This
// screen is real and saves for real; the runtime read side is the
// documented next step.
export const dynamic = "force-dynamic";

export default async function CopyEditorPage() {
  const org = await defaultOrganization();
  if (!org) notFound();

  const overrides = await copyOverridesForOrg(org.id);
  const rows = Object.entries(en)
    .map(([key, defaultValue]) => ({
      id: key,
      defaultValue,
      currentValue: overrides[key] ?? defaultValue,
      overridden: key in overrides,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <Card>
      <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
        Copy
      </h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
        Every piece of text the app can show, with its default wording from the codebase. Edit &quot;Current
        text&quot; to override it for this org; clear it back to blank to reset to the default. Saved overrides
        aren&apos;t live on the actual app yet — see the note in this page&apos;s source for why.
      </p>
      <CopyOverridesClient initialRows={rows} />
    </Card>
  );
}
