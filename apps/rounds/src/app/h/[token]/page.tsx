import { defaultOrganization, selfServiceView } from "@service-projects/database";
import { t } from "@/copy";
import { AppTopbar } from "../../AppTopbar";
import { SelfServiceForm } from "./SelfServiceForm";

// SPEC.md §4.4/§14.1: the household self-service page — `/h/<token>`,
// no login. The token is the whole authorization model here (see
// selfService.ts), so this page deliberately never touches the session.
export const dynamic = "force-dynamic";

export default async function SelfServicePage({ params }: { params: { token: string } }) {
  const org = await defaultOrganization();
  const view = org ? await selfServiceView(org.id, params.token) : null;

  return (
    <>
      <AppTopbar section={t("selfService.title")} />
      <main className="rounds-shell">
        {!view ? (
          <div className="rounds-hero">
            <h1>{t("selfService.notFound.title")}</h1>
            <p>{t("selfService.notFound.body")}</p>
          </div>
        ) : (
          <>
            <div className="rounds-hero" style={{ padding: "var(--space-6) 0" }}>
              <h1>{t("selfService.greeting", { name: view.household.contactName })}</h1>
              <p>{t("selfService.subtitle")}</p>
            </div>
            <SelfServiceForm token={params.token} view={view} />
          </>
        )}
      </main>
    </>
  );
}
