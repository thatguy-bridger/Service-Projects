"use client";

import { setCopyOverrides } from "./t";

/**
 * Applies the org's current copy overrides to the `t()` singleton
 * before anything else in the tree renders. Rendered once, near the top
 * of the root layout, with the overrides fetched server-side on every
 * request (see layout.tsx) -- setting module state during render (not
 * in a useEffect) is deliberate here: a useEffect would run after the
 * whole subtree already mounted with default-only text, which defeats
 * the point for the very first paint. It's safe because the call is
 * idempotent (plain object assignment, same result every time for the
 * same props) and doesn't schedule any further render.
 */
export function CopyHydrator({ overrides }: { overrides: Record<string, string> }) {
  setCopyOverrides(overrides);
  return null;
}
