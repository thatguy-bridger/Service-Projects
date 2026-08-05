import { UgrcProvider } from "./ugrc";
import { MockProvider } from "./mock";
import type { GeoProvider } from "./types";

export * from "./types";
export { UgrcProvider } from "./ugrc";
export { MockProvider } from "./mock";

let cached: GeoProvider | undefined;

/**
 * The one place app code should get a provider from — never `new
 * UgrcProvider(...)` directly, so swapping providers (or falling back
 * when UGRC_API_KEY isn't set) stays a one-line change. Same guarded
 * pattern as the auth providers in packages/core-auth: missing key ⇒
 * quietly falls back rather than crashing.
 */
export function getGeoProvider(): GeoProvider {
  if (cached) return cached;
  const apiKey = process.env.UGRC_API_KEY;
  cached = apiKey ? new UgrcProvider(apiKey) : new MockProvider();
  return cached;
}
