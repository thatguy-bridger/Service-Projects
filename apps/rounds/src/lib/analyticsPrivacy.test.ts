import { describe, it, expect } from "vitest";
import { redactAnalyticsUrl } from "./analyticsPrivacy";

describe("redactAnalyticsUrl", () => {
  it("redacts a self-service token out of the path", () => {
    expect(redactAnalyticsUrl("/h/AbCd123-secret_token")).toBe("/h/[redacted]");
  });

  it("redacts an invite code out of the path", () => {
    expect(redactAnalyticsUrl("/redeem/ABCD-2FGH")).toBe("/redeem/[redacted]");
  });

  it("drops a query string on an otherwise-safe path", () => {
    expect(redactAnalyticsUrl("/signup?utm_source=email")).toBe("/signup");
  });

  it("drops a query string on a sensitive path too", () => {
    expect(redactAnalyticsUrl("/h/secret-token?ref=email")).toBe("/h/[redacted]");
  });

  it("leaves an ordinary path untouched", () => {
    expect(redactAnalyticsUrl("/admin/events")).toBe("/admin/events");
    expect(redactAnalyticsUrl("/")).toBe("/");
  });

  it("doesn't redact the bare prefix with nothing after it", () => {
    expect(redactAnalyticsUrl("/h/")).toBe("/h/");
    expect(redactAnalyticsUrl("/redeem/")).toBe("/redeem/");
  });
});
