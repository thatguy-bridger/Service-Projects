import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { AppTopbar } from "@/app/AppTopbar";
import { RedeemClient } from "./RedeemClient";

export const dynamic = "force-dynamic";

export default async function RedeemPage({ params }: { params: { code: string } }) {
  const session = await getServerSession(authOptions);
  const signedIn = !!session?.user;

  return (
    <>
      <AppTopbar section="Redeem a key" />
      <main className="rounds-shell" style={{ maxWidth: 480, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
        <RedeemClient code={params.code} signedIn={signedIn} />
      </main>
    </>
  );
}
