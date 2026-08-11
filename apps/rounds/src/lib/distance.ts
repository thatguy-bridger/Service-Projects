// Straight-line (haversine) distance, not the real driving distance a
// routing engine would give -- good enough for the route screen's
// "distance summary" block (SPEC.md §11.3), which is meant as a rough
// sense of the route's size, not turn-by-turn navigation (that's
// handed off to the device's own maps app, see RouteRunner.tsx's
// navigationHref).
const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Sum of consecutive-stop distances, in the order given. */
export function totalRouteDistanceMeters(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i]);
  return total;
}
