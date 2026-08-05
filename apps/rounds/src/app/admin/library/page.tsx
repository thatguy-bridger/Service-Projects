import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, eventsForSession, searchHouseholds } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { t } from "@/copy";
import { LibraryResults } from "./LibraryResults";

// The org-wide "data library": search every household ever created for
// this org, then copy selected ones straight into any event that has a
// season — no CSV in the middle. Search is a plain GET (?q=) so it works
// without client JS; only the results/copy form below it needs one.
export const dynamic = "force-dynamic";

export default async function AdminLibraryPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  const query = searchParams.q ?? "";

  const households = org && query ? await searchHouseholds(session, org.id, query) : [];
  const events = org ? await eventsForSession(session, org.id) : [];
  const eventOptions = events.filter((ev) => ev.seasonId).map((ev) => ({ id: ev.id, name: ev.name }));

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
        {!query ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.library.search.prompt")}</p>
        ) : households.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.library.search.empty")}</p>
        ) : eventOptions.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.library.noEvents")}</p>
        ) : (
          <LibraryResults households={households} events={eventOptions} />
        )}
      </Card>
    </>
  );
}
