import { describe, it, expect } from "vitest";
import { haversineMeters, totalRouteDistanceMeters } from "./distance";

describe("haversineMeters", () => {
  it("returns 0 for the same point", () => {
    expect(haversineMeters({ lat: 40.6, lng: -111.9 }, { lat: 40.6, lng: -111.9 })).toBe(0);
  });

  it("returns a plausible distance for two nearby points", () => {
    // Roughly 0.01 degrees of latitude apart, ~1.1km.
    const meters = haversineMeters({ lat: 40.6, lng: -111.9 }, { lat: 40.61, lng: -111.9 });
    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(1200);
  });
});

describe("totalRouteDistanceMeters", () => {
  it("returns 0 for zero or one point", () => {
    expect(totalRouteDistanceMeters([])).toBe(0);
    expect(totalRouteDistanceMeters([{ lat: 40.6, lng: -111.9 }])).toBe(0);
  });

  it("sums consecutive-point distances in order", () => {
    const a = { lat: 40.6, lng: -111.9 };
    const b = { lat: 40.61, lng: -111.9 };
    const c = { lat: 40.62, lng: -111.9 };
    const total = totalRouteDistanceMeters([a, b, c]);
    expect(total).toBeCloseTo(haversineMeters(a, b) + haversineMeters(b, c), 5);
  });
});
