import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { myRouteDetail } from "@service-projects/database";
import { AppTopbar } from "../../AppTopbar";
import { RouteRunner } from "./RouteRunner";

export const dynamic = "force-dynamic";

export default async function MyRouteDetailPage({ params }: { params: { routeId: string } }) {
  const session = await getServerSession(authOptions);
  const route = await myRouteDetail(session, params.routeId);
  if (!route) notFound();

  return (
    <>
      <AppTopbar section={route.name} />
      <main className="rounds-shell">
        <RouteRunner route={route} />
      </main>
    </>
  );
}
