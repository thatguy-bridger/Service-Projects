import { describe, it, expect } from "vitest";
import { generateRecurringDates } from "./recurrence";

describe("generateRecurringDates", () => {
  it("returns nothing for an empty start date", () => {
    expect(generateRecurringDates("", "weekly", 4)).toEqual([]);
  });

  it("returns nothing for a non-positive count", () => {
    expect(generateRecurringDates("2027-01-01", "weekly", 0)).toEqual([]);
  });

  it("generates weekly occurrences 7 days apart", () => {
    expect(generateRecurringDates("2027-01-01", "weekly", 3)).toEqual(["2027-01-01", "2027-01-08", "2027-01-15"]);
  });

  it("generates biweekly occurrences 14 days apart", () => {
    expect(generateRecurringDates("2027-01-01", "biweekly", 3)).toEqual(["2027-01-01", "2027-01-15", "2027-01-29"]);
  });

  it("generates monthly occurrences on the same day of each month", () => {
    expect(generateRecurringDates("2027-01-15", "monthly", 3)).toEqual(["2027-01-15", "2027-02-15", "2027-03-15"]);
  });

  it("generates yearly occurrences on the same month/day", () => {
    expect(generateRecurringDates("2027-07-24", "yearly", 3)).toEqual(["2027-07-24", "2028-07-24", "2029-07-24"]);
  });

  it("a single occurrence is just the start date", () => {
    expect(generateRecurringDates("2027-03-10", "monthly", 1)).toEqual(["2027-03-10"]);
  });
});
