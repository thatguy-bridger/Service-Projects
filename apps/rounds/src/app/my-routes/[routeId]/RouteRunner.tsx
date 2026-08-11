"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Badge } from "@service-projects/ui";
import type { MyRouteDetail } from "@service-projects/database";
import { StopCardSlotBlocks, type StopCardData } from "@/blocks/StopCardBlocks";
import { RouteScreenSlotBlocks, renderRouteScreenBlock } from "@/blocks/RouteScreenBlocks";
import { totalRouteDistanceMeters } from "@/lib/distance";
import { recordVisitAction } from "./actions";

function navigationHref(lat: number, lng: number): string {
  // Universal deep link -- opens the device's own default maps app on
  // iOS and Android alike, no SDK/key needed. SPEC.md §9.4's "navigation
  // handoff", the cheap real version of it.
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

export function RouteRunner({ route }: { route: MyRouteDetail }) {
  const [stops, setStops] = useState(route.stops);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineStatus();

  const doneCount = stops.filter((s) => s.lastVisitOutcome).length;
  const allDone = stops.length > 0 && doneCount === stops.length;
  const nextStop = stops.find((s) => !s.lastVisitOutcome) ?? null;
  const distanceMeters = useMemo(() => totalRouteDistanceMeters(stops.map((s) => ({ lat: s.lat, lng: s.lng }))), [stops]);

  const routeScreenData = {
    doneCount,
    totalCount: stops.length,
    nextStop: nextStop ? { addressLine: nextStop.addressLine, sequence: nextStop.sequence } : null,
    briefingMd: route.briefingMd,
    distanceMeters,
    coordinatorContact: route.coordinatorContact,
    isOffline: !online,
  };

  async function recordOutcome(stopId: string, outcome: string, disposition: "SUCCESS" | "NEUTRAL" | "FAILED") {
    setRecordingId(stopId);
    setError(null);
    const result = await recordVisitAction({
      stopId,
      routeId: route.id,
      outcome,
      disposition,
      clientId: newClientId(),
    });
    setRecordingId(null);
    if (!result.ok) {
      setError(result.error ?? "Couldn't record that.");
      return;
    }
    setStops((prev) => prev.map((s) => (s.id === stopId ? { ...s, lastVisitOutcome: outcome } : s)));
  }

  if (allDone) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12) var(--space-5)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--weight-semibold)" }}>Route complete</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {stops.length} stop{stops.length === 1 ? "" : "s"} recorded. Thanks for getting out there.
        </p>
        <a href="/my-routes" style={{ color: "var(--color-accent-500)" }}>
          Back to my routes
        </a>
      </div>
    );
  }

  const stopList = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {stops.map((stop, i) => {
        const cardData: StopCardData = {
          sequence: i + 1,
          addressLine: stop.addressLine,
          label: stop.label,
          placementNote: stop.placementNote,
          accessNotes: stop.accessNotes,
          householdName: stop.householdName,
          phone: stop.phone,
        };
        return (
          <div key={stop.id} className="card" style={{ opacity: stop.lastVisitOutcome ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
              <div>
                <StopCardSlotBlocks layout={route.stopCardLayout} slot="primary" stop={cardData} />
                <StopCardSlotBlocks layout={route.stopCardLayout} slot="secondary" stop={cardData} />
              </div>
              {stop.lastVisitOutcome && <Badge tone="success">{stop.lastVisitOutcome}</Badge>}
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
              <a href={navigationHref(stop.lat, stop.lng)} target="_blank" rel="noreferrer">
                <Button type="button" variant="secondary">
                  Navigate
                </Button>
              </a>
              <StopCardSlotBlocks layout={route.stopCardLayout} slot="actions" stop={cardData} />
              {!stop.lastVisitOutcome &&
                route.outcomeOptions.map((opt) => (
                  <Button
                    key={opt.key}
                    type="button"
                    variant={opt.disposition === "SUCCESS" ? "primary" : opt.disposition === "FAILED" ? "danger" : "secondary"}
                    disabled={recordingId === stop.id}
                    onClick={() => recordOutcome(stop.id, opt.key, opt.disposition)}
                  >
                    {recordingId === stop.id ? "Saving…" : opt.key.replace(/_/g, " ")}
                  </Button>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-3)" }}>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)", margin: 0 }}>{route.name}</h1>
      </div>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <RouteScreenSlotBlocks layout={route.routeScreenLayout} slot="header" data={routeScreenData} />
      </div>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <RouteScreenSlotBlocks layout={route.routeScreenLayout} slot="peek" data={routeScreenData} />
      </div>

      {error && <p className="signup-error">{error}</p>}

      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        {(route.routeScreenLayout.slots.sheet ?? [])
          .filter((b) => b.visible)
          .map((b) => (
            <div key={b.blockId}>{b.blockId === "stop_list" ? stopList : renderRouteScreenBlock(b.blockId, routeScreenData)}</div>
          ))}
      </div>
    </div>
  );
}
