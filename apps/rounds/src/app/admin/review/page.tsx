import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, householdsNeedingReview } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { t } from "@/copy";
import { ReviewRow } from "./ReviewRow";

// SPEC.md §8/§9.3: the needs-review queue — every household whose
// address wasn't a trusted Google pick, or that landed within 25m of
// another household (submitSignup's duplicate check), lands here
// instead of silently becoming a stop later. Staff-only via
// householdsNeedingReview's own resolveMembership check.
export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  const households = org ? await householdsNeedingReview(session, org.id) : [];

  return (
    <Card>
      <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
        {t("admin.review.title")}
      </h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("admin.review.subtitle")}</p>

      {households.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>{t("admin.review.empty")}</p>
      ) : (
        <div className="admin-tableWrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>{t("admin.review.table.name")}</th>
                <th style={thStyle}>{t("admin.review.table.address")}</th>
                <th style={thStyle}>{t("admin.review.table.reason")}</th>
                <th style={thStyle}>{t("admin.review.table.submitted")}</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {households.map((h) => (
                <ReviewRow
                  key={h.id}
                  household={{
                    id: h.id,
                    contactName: h.contactName,
                    addressInput: h.addressInput,
                    needsReviewReason: h.needsReviewReason,
                    createdAt: h.createdAt,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--text-xs)",
  color: "var(--text-muted)",
  fontWeight: "var(--weight-medium)" as unknown as number,
};
