"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import {
  renameRoute,
  deleteRoutes,
  createRoute,
  autoSplitStopsIntoRoutes,
  assignVolunteerToRoute,
  type ActionResult,
  type AutoSplitResult,
} from "@service-projects/database";

export async function saveRouteRowAction(
  eventId: string,
  routeId: string,
  patch: Record<string, string>
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  const result = await renameRoute(session, eventId, routeId, {
    name: patch.name,
    status: patch.status,
    color: patch.color,
  });
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function deleteRoutesAction(eventId: string, routeIds: string[]): Promise<{ deleted: number }> {
  const session = await getServerSession(authOptions);
  const result = await deleteRoutes(session, eventId, routeIds);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function addRouteAction(eventId: string, values: Record<string, string>): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  const result = await createRoute(session, eventId, values.name ?? "");
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function autoSplitAction(eventId: string, routeCount: number): Promise<AutoSplitResult> {
  const session = await getServerSession(authOptions);
  const result = await autoSplitStopsIntoRoutes(session, eventId, routeCount);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function assignVolunteerAction(
  eventId: string,
  routeId: string,
  email: string
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  const result = await assignVolunteerToRoute(session, eventId, routeId, email);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}
