import { describe, it, expect } from "vitest";
import { formatCentsShort, formatCentsFull, formatHolidayDate } from "./format";

describe("formatCentsShort", () => {
  it("drops decimals for a whole dollar amount", () => {
    expect(formatCentsShort(1200)).toBe("$12");
  });

  it("keeps two decimals for a fractional amount", () => {
    expect(formatCentsShort(1250)).toBe("$12.50");
    expect(formatCentsShort(105)).toBe("$1.05");
  });

  it("handles zero", () => {
    expect(formatCentsShort(0)).toBe("$0");
  });
});

describe("formatCentsFull", () => {
  it("always shows two decimals, even for a whole dollar amount", () => {
    expect(formatCentsFull(1200)).toBe("$12.00");
    expect(formatCentsFull(3600)).toBe("$36.00");
  });

  it("handles zero", () => {
    expect(formatCentsFull(0)).toBe("$0.00");
  });
});

describe("formatHolidayDate", () => {
  it("formats as weekday, month, day in UTC — matching the mockup's style", () => {
    // Pioneer Day 2027 (Sat 24 Jul 2027), verified in
    // docs/rounds/PHASE-1.md's calendar-math check.
    expect(formatHolidayDate(new Date(Date.UTC(2027, 6, 24)))).toBe("Sat, July 24");
  });

  it("doesn't shift a UTC-midnight date to a different local day", () => {
    // The whole reason timeZone: "UTC" is pinned — a date constructed at
    // UTC midnight must format as that same calendar day everywhere,
    // regardless of the machine's local timezone.
    expect(formatHolidayDate(new Date(Date.UTC(2027, 1, 15)))).toBe("Mon, February 15");
  });
});
