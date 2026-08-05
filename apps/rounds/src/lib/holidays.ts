/** SPEC.md §4.2: the default season's holidays offered for flags in Utah. */
export interface HolidayDef {
  key: string;
  name: string;
  dateFor(year: number): Date;
}

function nthWeekdayOfMonth(year: number, monthIndex0: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(Date.UTC(year, monthIndex0, day));
}

function lastWeekdayOfMonth(year: number, monthIndex0: number, weekday: number): Date {
  const lastDayNum = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, monthIndex0, lastDayNum));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, monthIndex0, lastDayNum - offset));
}

// Monday = 1 in getUTCDay()'s 0=Sunday..6=Saturday scheme.
const MONDAY = 1;

export const FLAG_HOLIDAYS: HolidayDef[] = [
  { key: "presidents_day", name: "Presidents Day", dateFor: (y) => nthWeekdayOfMonth(y, 1, MONDAY, 3) },
  { key: "memorial_day", name: "Memorial Day", dateFor: (y) => lastWeekdayOfMonth(y, 4, MONDAY) },
  { key: "flag_day", name: "Flag Day", dateFor: (y) => new Date(Date.UTC(y, 5, 14)) },
  { key: "independence_day", name: "Independence Day", dateFor: (y) => new Date(Date.UTC(y, 6, 4)) },
  // Utah-specific, and locally the biggest one — SPEC.md §4.2.
  { key: "pioneer_day", name: "Pioneer Day", dateFor: (y) => new Date(Date.UTC(y, 6, 24)) },
  { key: "labor_day", name: "Labor Day", dateFor: (y) => nthWeekdayOfMonth(y, 8, MONDAY, 1) },
  { key: "veterans_day", name: "Veterans Day", dateFor: (y) => new Date(Date.UTC(y, 10, 11)) },
];

export function holidaysForYear(year: number) {
  return FLAG_HOLIDAYS.map((h) => ({ key: h.key, name: h.name, date: h.dateFor(year) }));
}
