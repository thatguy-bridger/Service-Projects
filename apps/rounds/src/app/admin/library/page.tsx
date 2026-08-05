import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, eventsForSession, browseHouseholds, type HouseholdSortField } from "@service-projects/database";
import { Card } from "@service-projects/ui";
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
  const eventOptions = events.filter((ev) => ev.seasonId).map((ev) => ({ id: ev.id, name: ev.name }));
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <>
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
        {result.households.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.library.search.empty")}</p>
        ) : eventOptions.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.library.noEvents")}</p>
        ) : (
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
        )}
      </Card>
    </>
  );
}
