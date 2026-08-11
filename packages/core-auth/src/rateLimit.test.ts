import { describe, it, expect, vi, afterEach } from "vitest";
import { rateLimit, clientIpFromHeaders, hashIp } from "./rateLimit";

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 5, 60_000).allowed).toBe(true);
    }
  });

  it("blocks once the limit is reached within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, 60_000);
    }
    const result = rateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("different keys have independent buckets", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit(keyA, 5, 60_000);
    expect(rateLimit(keyA, 5, 60_000).allowed).toBe(false);
    expect(rateLimit(keyB, 5, 60_000).allowed).toBe(true);
  });

  it("resets once the window elapses", () => {
    vi.useFakeTimers();
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 1000);
    expect(rateLimit(key, 5, 1000).allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(rateLimit(key, 5, 1000).allowed).toBe(true);
  });
});

describe("clientIpFromHeaders", () => {
  it("reads the first address from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.9" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it('falls back to "unknown" when neither header is present', () => {
    const headers = new Headers();
    expect(clientIpFromHeaders(headers)).toBe("unknown");
  });
});

describe("hashIp", () => {
  it("never returns the raw address", () => {
    expect(hashIp("203.0.113.5")).not.toContain("203.0.113.5");
  });

  it("is deterministic for the same input", () => {
    expect(hashIp("203.0.113.5")).toBe(hashIp("203.0.113.5"));
  });

  it("differs for different inputs", () => {
    expect(hashIp("203.0.113.5")).not.toBe(hashIp("203.0.113.6"));
  });

  it("returns a hex-encoded sha256 digest (64 chars)", () => {
    expect(hashIp("203.0.113.5")).toMatch(/^[0-9a-f]{64}$/);
  });
});
