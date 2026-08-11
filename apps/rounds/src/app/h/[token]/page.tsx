import { headers } from "next/headers";
import { defaultOrganization, selfServiceView } from "@service-projects/database";
import { rateLimit, clientIpFromHeaders } from "@service-projects/core-auth";
import { t } from "@/copy";
import { AppTopbar } from "../../AppTopbar";
import { SelfServiceForm } from "./SelfServiceForm";

// SPEC.md §4.4/§14.1: the household self-service page — `/h/<token>`,
// no login. The token is the whole authorization model here (see
// selfService.ts), so this page deliberately never touches the session.
export const dynamic = "force-dynamic";

export default async function SelfServicePage({ params }: { params: { token: string } }) {
  // SPEC.md §20: "self-service token 30/hour" -- the token itself is a
  // 256-bit random value (not practically guessable), but rate-limiting
  // the lookup is still cheap defense-in-depth against a script
  // hammering this route. Same key prefix as the mutating actions
  // (actions.ts), so the real ceiling on "self-service activity from
  // one IP" is 30/hour total, not 30 for the page plus 30 more per
  // action.
  const ip = clientIpFromHeaders(headers());
  const limited = !rateLimit(`self-service:${ip}`, 30, 60 * 60 * 1000).allowed;
  const org = limited ? null : await defaultOrganization();
  const view = org ? await selfServiceView(org.id, params.token) : null;

  return (
    <>
      <AppTopbar section={t("selfService.title")} />
      <main className="rounds-shell">
        {limited ? (
          <div className="rounds-hero">
            <h1>{t("selfService.notFound.title")}</h1>
            <p>Too many attempts from this connection — try again later.</p>
          </div>
        ) : !view ? (
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
