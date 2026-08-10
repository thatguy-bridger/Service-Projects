export type Frequency = "weekly" | "biweekly" | "monthly" | "yearly";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  yearly: "Yearly",
};

/** Pure so it's easy to reason about/verify — no state, just dates in, dates out. */
export function generateRecurringDates(startDate: string, frequency: Frequency, count: number): string[] {
  if (!startDate || count < 1) return [];
  const [y, m, d] = startDate.split("-").map(Number);
  if (!y || !m || !d) return [];

  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    let date: Date;
    if (frequency === "weekly") date = new Date(Date.UTC(y, m - 1, d + i * 7));
    else if (frequency === "biweekly") date = new Date(Date.UTC(y, m - 1, d + i * 14));
    else if (frequency === "monthly") date = new Date(Date.UTC(y, m - 1 + i, d));
    else date = new Date(Date.UTC(y + i, m - 1, d));
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}
