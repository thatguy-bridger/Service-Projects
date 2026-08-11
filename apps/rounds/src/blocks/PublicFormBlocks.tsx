import type { ReactNode } from "react";
import type { ScreenLayout, PublicFormSlot, PublicFormFeaturedEvent } from "@service-projects/database/layoutBlocks";

function formatDateRange(startIso: string): string {
  return new Date(startIso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function formatPrice(cents: number): string {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

function renderBlock(blockId: string, featured: PublicFormFeaturedEvent | null): ReactNode {
  switch (blockId) {
    case "cover_image":
      return featured?.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={featured.coverImageUrl}
          alt=""
          style={{ width: "100%", borderRadius: "var(--radius-lg)", display: "block" }}
        />
      ) : null;
    case "description":
      return featured?.summary ? (
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>{featured.summary}</p>
      ) : null;
    case "dates":
      return featured ? (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          Starts {formatDateRange(featured.serviceStartsAt)}
        </p>
      ) : null;
    case "price_summary":
      return featured ? (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          From {formatPrice(featured.priceCents)}
        </p>
      ) : null;
    case "privacy_notice":
      return (
        <p style={{ margin: 0, color: "var(--text-tertiary, var(--text-secondary))", fontSize: "var(--text-xs)" }}>
          Your address and contact info are only used to plan and deliver this service — never sold or shared.
        </p>
      );
    default:
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[layoutBlocks] unknown public-form block id "${blockId}"`);
      }
      return null;
  }
}

export function PublicFormSlotBlocks({
  layout,
  slot,
  featured,
}: {
  layout: ScreenLayout;
  slot: PublicFormSlot;
  featured: PublicFormFeaturedEvent | null;
}) {
  const blocks = (layout.slots[slot] ?? []).filter((b) => b.visible);
  return (
    <>
      {blocks.map((b) => (
        <span key={b.blockId} style={{ display: "contents" }}>
          {renderBlock(b.blockId, featured)}
        </span>
      ))}
    </>
  );
}
