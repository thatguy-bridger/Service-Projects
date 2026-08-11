"use client";

import { useEffect, useState } from "react";

// SPEC.md §16.2's offline mode is real scope (a service worker, tile
// packs, a visit queue with sync) this app doesn't have yet -- that's
// a project in itself, not a component. What's cheap and honest to
// ship now is telling a volunteer standing at a door with no signal
// that anything they do here (recording a visit, especially) won't
// save until they're back online, instead of letting them find out
// later when the route looks like nothing happened.
export function OfflineBanner() {
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

  if (online) return null;

  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        width: "100%",
        boxSizing: "border-box",
        padding: "var(--space-2) var(--space-4)",
        textAlign: "center",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-medium)",
        background: "var(--color-warning-500)",
        color: "#1a1200",
      }}
    >
      You&apos;re offline — anything you do here won&apos;t save until your connection comes back.
    </div>
  );
}
