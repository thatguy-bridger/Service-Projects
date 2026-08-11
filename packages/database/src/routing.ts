// Phase 3 (SPEC.md §9.3): real route-building math, not a placeholder.
// Pure functions, no Prisma/DB dependency, so they're unit-testable
// directly and reusable from whichever caller needs them (scoped
// helpers today, a live re-optimize action later).

export interface RoutablePoint {
  id: string;
  lat: number;
  lng: number;
}

function haversineMeters(a: RoutablePoint, b: RoutablePoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function totalDistance(points: RoutablePoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) sum += haversineMeters(points[i], points[i + 1]);
  return sum;
}

/**
 * Orders a set of points into a short route: nearest-neighbor greedy
 * construction, then a bounded 2-opt pass that keeps swapping any pair
 * of edges that shortens the total route until no swap in one full pass
 * helps (or a hard iteration cap, so this stays fast even on a few
 * hundred stops -- SPEC.md's 2,000-stop event isn't going on one route).
 */
export function orderRouteStops(points: RoutablePoint[]): RoutablePoint[] {
  if (points.length <= 2) return points;

  // Nearest-neighbor construction.
  const remaining = [...points];
  const route: RoutablePoint[] = [remaining.shift()!];
  while (remaining.length > 0) {
    const last = route[route.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMeters(last, remaining[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    route.push(remaining.splice(nearestIdx, 1)[0]);
  }

  // 2-opt improvement: try reversing every segment [i, j]; keep the
  // reversal if it shortens the route. Each pass is O(n^2) haversine
  // calls, and this runs up to maxPasses times -- fine for one route's
  // worth of stops (tens to low hundreds), but a caller that hands this
  // an unsplit, arbitrarily large batch (createRouteFromStops takes
  // whatever the map lasso selected, with no size cap of its own) could
  // otherwise multiply that O(n^2) by 20 passes into something that
  // runs long enough to threaten a serverless function's timeout. Above
  // this threshold, skip refinement and ship the nearest-neighbor route
  // as-is -- still a reasonable order, just not locally 2-opt-optimal,
  // which is a far better failure mode than a request that never
  // returns. Not benchmarked against real infra (no live deployment in
  // this environment -- see docs/rounds/OPEN-QUESTIONS.md's UGRC note
  // for the same constraint); the threshold is a conservative estimate,
  // worth revisiting with a real load test per SPEC.md §21 Phase 3.
  const TWO_OPT_MAX_POINTS = 400;
  if (points.length > TWO_OPT_MAX_POINTS) return route;

  const maxPasses = 20;
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let i = 1; i < route.length - 2; i++) {
      for (let j = i + 1; j < route.length - 1; j++) {
        const before =
          haversineMeters(route[i - 1], route[i]) + haversineMeters(route[j], route[j + 1]);
        const after =
          haversineMeters(route[i - 1], route[j]) + haversineMeters(route[i], route[j + 1]);
        if (after + 1e-6 < before) {
          const segment = route.slice(i, j + 1).reverse();
          route.splice(i, segment.length, ...segment);
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  return route;
}

/**
 * Splits stops into `routeCount` geographically-compact groups via a
 * boustrophedon ("snake") sort: divide the point cloud into latitude
 * bands, sort each band by longitude, alternating direction band to
 * band, then chop the resulting single ordering into `routeCount`
 * contiguous, roughly-equal chunks. A real, working first pass -- not
 * true k-means clustering, but it keeps each route's stops close
 * together and gives every route a walkable order for free, since a
 * snake path is already close to a good route.
 */
export function splitIntoRoutes<T extends RoutablePoint>(points: T[], routeCount: number): T[][] {
  if (routeCount <= 0 || points.length === 0) return [];
  if (routeCount === 1) return [points];

  const bandCount = Math.max(1, Math.ceil(Math.sqrt(routeCount)));
  const lats = points.map((p) => p.lat);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const bandHeight = (maxLat - minLat || 1) / bandCount;

  const banded = new Map<number, T[]>();
  for (const p of points) {
    const band = Math.min(bandCount - 1, Math.floor((p.lat - minLat) / bandHeight));
    if (!banded.has(band)) banded.set(band, []);
    banded.get(band)!.push(p);
  }

  const snake: T[] = [];
  for (let b = 0; b < bandCount; b++) {
    const bandPoints = (banded.get(b) ?? []).slice().sort((a, c) => a.lng - c.lng);
    if (b % 2 === 1) bandPoints.reverse();
    snake.push(...bandPoints);
  }

  const perRoute = Math.ceil(snake.length / routeCount);
  const routes: T[][] = [];
  for (let i = 0; i < snake.length; i += perRoute) {
    routes.push(snake.slice(i, i + perRoute));
  }
  return routes;
}

export function routeDistanceMeters(points: RoutablePoint[]): number {
  return Math.round(totalDistance(points));
}
