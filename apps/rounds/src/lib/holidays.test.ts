import { describe, it, expect } from "vitest";
import { FLAG_HOLIDAYS, holidaysForYear } from "./holidays";

// SPEC.md §4.2's default holiday list, computed via real
// nth-weekday-of-month / last-weekday-of-month rules — see
// docs/rounds/PHASE-1.md for the discrepancy this caught against the
// design mockup's hand-typed (and internally inconsistent) dates.
// These pin the exact dates that were manually verified there, so a
// future refactor of the date math can't silently drift.
const EXPECTED_2027: Record<string, string> = {
  presidents_day: "2027-02-15",
  memorial_day: "2027-05-31",
  flag_day: "2027-06-14",
  independence_day: "2027-07-04",
  pioneer_day: "2027-07-24",
  labor_day: "2027-09-06",
  veterans_day: "2027-11-11",
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe("holidaysForYear", () => {
  it("computes the verified 2027 dates for every default holiday", () => {
    const holidays = holidaysForYear(2027);
    for (const h of holidays) {
      expect(isoDate(h.date), h.key).toBe(EXPECTED_2027[h.key]);
    }
  });

  it("returns one entry per FLAG_HOLIDAYS definition, in the same order", () => {
    const holidays = holidaysForYear(2027);
    expect(holidays.map((h) => h.key)).toEqual(FLAG_HOLIDAYS.map((h) => h.key));
  });

  it("nth-weekday holidays always land on a Monday", () => {
    // Presidents Day, Memorial Day, Labor Day are all "the Nth/last
    // Monday of month X" — assert the weekday, not just a pinned date,
    // so this still catches a regression in a year other than 2027.
    for (const year of [2024, 2025, 2026, 2027, 2028, 2030]) {
      const holidays = holidaysForYear(year);
      for (const key of ["presidents_day", "memorial_day", "labor_day"]) {
        const h = holidays.find((x) => x.key === key)!;
        expect(h.date.getUTCDay(), `${key} in ${year}`).toBe(1); // Monday
      }
    }
  });

  it("fixed-date holidays land on the same calendar day every year", () => {
    for (const year of [2024, 2026, 2029]) {
      const holidays = holidaysForYear(year);
      expect(isoDate(holidays.find((h) => h.key === "flag_day")!.date)).toBe(`${year}-06-14`);
      expect(isoDate(holidays.find((h) => h.key === "independence_day")!.date)).toBe(`${year}-07-04`);
      expect(isoDate(holidays.find((h) => h.key === "pioneer_day")!.date)).toBe(`${year}-07-24`);
      expect(isoDate(holidays.find((h) => h.key === "veterans_day")!.date)).toBe(`${year}-11-11`);
    }
  });
});
