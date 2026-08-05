import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { Card, Button, BrandMark } from "@service-projects/ui";
import { t } from "@/copy";
import { chooseCustomerIntent, chooseVolunteerIntent } from "./actions";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");
  if (session.user.onboardedAt) redirect("/");

  return (
    <main className="rounds-shell">
      <header className="rounds-topbar">
        <BrandMark size={32} />
        <span className="rounds-brand">{t("brand.name")}</span>
      </header>

      <section className="rounds-hero">
        <h1>{t("welcome.title")}</h1>
        <p>{t("welcome.subtitle")}</p>
      </section>

      <div className="welcome-grid">
        <Card>
          <h2 style={{ margin: "0 0 8px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)" }}>
            {t("welcome.customer.title")}
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>{t("welcome.customer.body")}</p>
          <form action={chooseCustomerIntent}>
            <Button type="submit" variant="primary" size="lg">
              {t("welcome.customer.cta")}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 style={{ margin: "0 0 8px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)" }}>
            {t("welcome.volunteer.title")}
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>{t("welcome.volunteer.body")}</p>
          <form action={chooseVolunteerIntent}>
            <Button type="submit" variant="secondary" size="lg">
              {t("welcome.volunteer.cta")}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
