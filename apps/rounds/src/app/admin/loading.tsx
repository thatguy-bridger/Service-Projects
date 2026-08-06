import { Card } from "@service-projects/ui";
import { t } from "@/copy";

// Next.js renders this automatically while any /admin/* server component
// is fetching — the "loading" state SPEC.md §13's list rule (empty /
// loading / error / too-many) calls for, which nothing under /admin had
// until now: a full unstyled blank page during every navigation.
export default function AdminLoading() {
  return (
    <Card aria-busy="true" aria-live="polite">
      <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("admin.loading")}</p>
    </Card>
  );
}
