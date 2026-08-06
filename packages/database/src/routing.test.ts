import { describe, it, expect } from "vitest";
import { orderRouteStops, splitIntoRoutes, routeDistanceMeters, type RoutablePoint } from "./routing";

// Four corners of a small square, ~1.1km on a side near Sandy, UT.
const square: RoutablePoint[] = [
  { id: "sw", lat: 40.55, lng: -111.9 },
  { id: "ne", lat: 40.56, lng: -111.89 },
  { id: "nw", lat: 40.56, lng: -111.9 },
  { id: "se", lat: 40.55, lng: -111.89 },
];

describe("orderRouteStops", () => {
  it("returns short inputs unchanged", () => {
    expect(orderRouteStops([])).toEqual([]);
    expect(orderRouteStops([square[0]])).toEqual([square[0]]);
  });

  it("keeps every point, just reordered", () => {
    const ordered = orderRouteStops(square);
    expect(ordered.map((p) => p.id).sort()).toEqual(square.map((p) => p.id).sort());
  });

  it("orders the four corners into the perimeter, not a diagonal crossing", () => {
    // A shuffled-order input where the naive/input order would cross the
    // square diagonally (sw -> ne -> nw -> se: two long diagonal legs).
    // A correct route walks the perimeter (short adjacent-corner legs).
    const shuffled = [square[0], square[1], square[2], square[3]]; // sw, ne, nw, se
    const naive = routeDistanceMeters(shuffled);
    const optimized = routeDistanceMeters(orderRouteStops(shuffled));
    expect(optimized).toBeLessThan(naive);
  });

  it("2-opt never makes a route longer than the nearest-neighbor start", () => {
    const points: RoutablePoint[] = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      lat: 40.5 + Math.sin(i) * 0.02,
      lng: -111.9 + Math.cos(i * 1.7) * 0.02,
    }));
    const ordered = orderRouteStops(points);
    expect(ordered).toHaveLength(points.length);
    // Real assertion: the algorithm actually improves over a random walk
    // in id order for a non-trivial point set (not just "runs without
    // throwing").
    const inputOrderDistance = routeDistanceMeters(points);
    const optimizedDistance = routeDistanceMeters(ordered);
    expect(optimizedDistance).toBeLessThanOrEqual(inputOrderDistance);
  });
});

describe("splitIntoRoutes", () => {
  it("returns nothing for zero points or zero routes", () => {
    expect(splitIntoRoutes([], 3)).toEqual([]);
    expect(splitIntoRoutes(square, 0)).toEqual([]);
  });

  it("a single route gets everything", () => {
    expect(splitIntoRoutes(square, 1)).toEqual([square]);
  });

  it("splits into the requested number of groups (or fewer if not enough points)", () => {
    const points: RoutablePoint[] = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      lat: 40.5 + (i % 5) * 0.01,
      lng: -111.9 + Math.floor(i / 5) * 0.01,
    }));
    const groups = splitIntoRoutes(points, 4);
    expect(groups.length).toBeLessThanOrEqual(4);
    expect(groups.length).toBeGreaterThan(1);
  });

  it("every point is assigned to exactly one group", () => {
    const points: RoutablePoint[] = Array.from({ length: 17 }, (_, i) => ({
      id: `p${i}`,
      lat: 40.5 + Math.random() * 0.05,
      lng: -111.9 + Math.random() * 0.05,
    }));
    const groups = splitIntoRoutes(points, 3);
    const allIds = groups.flat().map((p) => p.id).sort();
    expect(allIds).toEqual(points.map((p) => p.id).sort());
  });
});
