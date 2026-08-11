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
  assignStopsToRoute,
  createRouteFromStops,
  type ActionResult,
  type AutoSplitResult,
  type AssignStopsResult,
  type CreateRouteFromStopsResult,
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
    briefingMd: patch.briefingMd,
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

// The map's lasso-select write paths — see StopMap.tsx.

export async function assignSelectedStopsAction(
  eventId: string,
  routeId: string,
  stopIds: string[]
): Promise<AssignStopsResult> {
  const session = await getServerSession(authOptions);
  const result = await assignStopsToRoute(session, eventId, routeId, stopIds);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function createRouteFromSelectedStopsAction(
  eventId: string,
  name: string,
  stopIds: string[]
): Promise<CreateRouteFromStopsResult> {
  const session = await getServerSession(authOptions);
  const result = await createRouteFromStops(session, eventId, name, stopIds);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

