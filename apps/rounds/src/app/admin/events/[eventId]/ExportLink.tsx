"use client";

import { t } from "@/copy";

// SPEC.md §20: "Exports audited, rate-limited, and warned before
// download." This is the warning -- a plain <a href> would just start
// the download with no chance to back out. window.confirm matches the
// same pattern this app already uses for other irreversible-ish actions
// (e.g. bulk delete confirmations).
export function ExportLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      style={{ color: "var(--color-accent-600)", fontSize: "var(--text-sm)" }}
      onClick={(e) => {
        if (!window.confirm(t("admin.eventDetail.export.confirm"))) e.preventDefault();
      }}
    >
      {t("admin.eventDetail.export")}
    </a>
  );
}
