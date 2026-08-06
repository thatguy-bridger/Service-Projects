import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, householdsNeedingReview } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { t } from "@/copy";
import { ReviewTable } from "./ReviewTable";

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

      <ReviewTable households={households} />
    </Card>
  );
}
