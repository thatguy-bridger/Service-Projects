import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import {
  defaultOrganization,
  eventsForSession,
  browseHouseholds,
  householdRetentionSummary,
  type HouseholdSortField,
} from "@service-projects/database";
import { Card, Badge } from "@service-projects/ui";
import { t } from "@/copy";
import { LibraryResults } from "./LibraryResults";

// The org-wide "data library": browse every household ever created for
// this org (sortable, paginated), then copy or delete selected ones —
// no CSV in the middle. Sort/page/search are plain GET params so it works
// without client JS; only the results/bulk-action form below needs one.
export const dynamic = "force-dynamic";

const SORT_FIELDS: HouseholdSortField[] = ["contactName", "contactEmail", "addressInput", "createdAt"];
const PAGE_SIZE = 50;

export default async function AdminLibraryPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  const query = searchParams.q ?? "";
  const sortBy = (SORT_FIELDS.includes(searchParams.sort as HouseholdSortField) ? searchParams.sort : "createdAt") as HouseholdSortField;
  const sortDir = searchParams.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const result = org
    ? await browseHouseholds(session, org.id, { query, sortBy, sortDir, page, pageSize: PAGE_SIZE })
    : { households: [], total: 0, page: 1, pageSize: PAGE_SIZE };

  const events = org ? await eventsForSession(session, org.id) : [];
  const eventOptions = events.map((ev) => ({ id: ev.id, name: ev.name }));
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const retention = org ? await householdRetentionSummary(session, org.id) : { pastRetentionCount: 0, dueSoonCount: 0, pastRetention: [] };
  const SHOWN_RETENTION_ROWS = 10;

  return (
    <>
      {(retention.pastRetentionCount > 0 || retention.dueSoonCount > 0) && (
        <Card style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)" }}>
              {t("admin.library.retention.title")}
            </h2>
            {retention.pastRetentionCount > 0 && <Badge tone="danger">{retention.pastRetentionCount}</Badge>}
          </div>
          {retention.pastRetentionCount > 0 && (
            <p style={{ margin: "4px 0" }}>{t("admin.library.retention.pastDue", { count: retention.pastRetentionCount })}</p>
          )}
          {retention.dueSoonCount > 0 && (
            <p style={{ margin: "4px 0", color: "var(--text-secondary)" }}>
              {t("admin.library.retention.dueSoon", { count: retention.dueSoonCount })}
            </p>
          )}
          {retention.pastRetentionCount > 0 && (
            <>
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{t("admin.library.retention.note")}</p>
              <ul style={{ margin: 0, paddingLeft: "1.25em", display: "grid", gap: 4 }}>
                {retention.pastRetention.slice(0, SHOWN_RETENTION_ROWS).map((h) => (
                  <li key={h.id} style={{ fontSize: "var(--text-sm)" }}>
                    <strong>{h.contactName}</strong> — {h.addressInput} —{" "}
                    <span style={{ color: "var(--text-secondary)" }}>
                      {t("admin.library.retention.lastEvent", {
                        date: new Date(h.lastEventAt).toLocaleDateString(),
                        months: h.monthsSinceLastEvent,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
              {retention.pastRetentionCount > SHOWN_RETENTION_ROWS && (
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "4px 0 0" }}>
                  {t("admin.library.retention.andMore", { count: retention.pastRetentionCount - SHOWN_RETENTION_ROWS })}
                </p>
              )}
            </>
          )}
        </Card>
      )}

      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("admin.library.title")}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("admin.library.subtitle")}</p>

        <form method="GET" className="admin-formRow">
          <label className="signup-field" style={{ marginBottom: 0, flex: 1, minWidth: 240 }}>
            <span className="signup-fieldLabel">{t("admin.library.search.label")}</span>
            <input
              className="signup-input"
              type="text"
              name="q"
              defaultValue={query}
              placeholder={t("admin.library.search.placeholder")}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            {t("admin.library.search.submit")}
          </button>
        </form>
      </Card>

      <Card>
        <LibraryResults
          households={result.households}
          events={eventOptions}
          total={result.total}
          page={result.page}
          totalPages={totalPages}
          query={query}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </Card>
    </>
  );
}
