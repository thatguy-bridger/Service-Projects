import type { ReactNode } from "react";
import { Button } from "@service-projects/ui";
import type { ScreenLayout, EventLandingSlot } from "@service-projects/database/layoutBlocks";

export interface EventLandingData {
  name: string;
  summary: string | null;
  coverImageUrl: string | null;
  serviceStartsAt: string;
  serviceEndsAt: string;
  priceCents: number;
  categoryName: string | null;
  categoryBundlePriceCents: number | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function formatPrice(cents: number): string {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

function renderBlock(blockId: string, data: EventLandingData): ReactNode {
  switch (blockId) {
    case "hero":
      return (
        <div>
          {data.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.coverImageUrl}
              alt=""
              style={{ width: "100%", borderRadius: "var(--radius-lg)", display: "block", marginBottom: "var(--space-4)" }}
            />
          )}
          <h1 style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: "var(--weight-semibold)" }}>{data.name}</h1>
        </div>
      );
    case "description":
      return data.summary ? <p style={{ color: "var(--text-secondary)" }}>{data.summary}</p> : null;
    case "event_date":
      return (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          {formatDate(data.serviceStartsAt)}
          {data.serviceStartsAt !== data.serviceEndsAt ? ` – ${formatDate(data.serviceEndsAt)}` : ""}
        </p>
      );
    case "price_table":
      return (
        <div className="card" style={{ padding: "var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
            <span style={{ color: "var(--text-secondary)" }}>{data.name}</span>
            <span style={{ fontWeight: "var(--weight-medium)" }}>{formatPrice(data.priceCents)}</span>
          </div>
          {data.categoryName && data.categoryBundlePriceCents != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--text-secondary)" }}>{data.categoryName} bundle</span>
              <span style={{ fontWeight: "var(--weight-medium)" }}>{formatPrice(data.categoryBundlePriceCents)}</span>
            </div>
          )}
        </div>
      );
    case "signup_cta":
      return (
        <a href="/signup">
          <Button variant="primary">Sign up</Button>
        </a>
      );
    default:
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[layoutBlocks] unknown event-landing block id "${blockId}"`);
      }
      return null;
  }
}

export function EventLandingSlotBlocks({
  layout,
  slot,
  data,
}: {
  layout: ScreenLayout;
  slot: EventLandingSlot;
  data: EventLandingData;
}) {
  const blocks = (layout.slots[slot] ?? []).filter((b) => b.visible);
  return (
    <>
      {blocks.map((b) => (
        <span key={b.blockId} style={{ display: "contents" }}>
          {renderBlock(b.blockId, data)}
        </span>
      ))}
    </>
  );
}
