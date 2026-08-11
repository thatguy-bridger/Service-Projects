import { notFound } from "next/navigation";
import { defaultOrganization, copyOverridesForOrg } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { en } from "@/copy";
import { CopyOverridesClient } from "./CopyOverridesClient";

// SPEC.md §11.1/§21 Phase 8: the copy editor. Every key in en.ts (the
// code-default layer) is listed here whether or not it's overridden, so
// an admin can browse/search everything the app actually says, not just
// what's already been changed. Saved overrides are live -- the root
// layout (app/layout.tsx) resolves this org's UiCopyOverride rows fresh
// on every request and applies them to the `t()` singleton every call
// site already uses (see copy/t.ts's setCopyOverrides), so a save here
// changes what the very next page load shows, no per-screen wiring
// needed.
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
        text&quot; to override it for this org; clear it back to blank to reset to the default. Changes take
        effect on the next page load — everywhere, including the public signup flow.
      </p>
      <CopyOverridesClient initialRows={rows} />
    </Card>
  );
}
