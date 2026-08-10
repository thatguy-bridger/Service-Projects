"use client";

import { useState } from "react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(year: number, monthIndex0: number, day: number): string {
  const mm = String(monthIndex0 + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * A plain month-grid calendar, no external library. Dates that already
 * have an event row (per `selectedDates`) are highlighted; clicking any
 * date toggles it via `onToggleDate` -- the parent owns what "toggle"
 * actually means (add a templated row / remove the row(s) for that
 * date), this component only knows about display and clicks.
 */
export function EventCalendar({
  selectedDates,
  onToggleDate,
}: {
  selectedDates: Set<string>;
  onToggleDate: (dateKey: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(today.getUTCMonth()); // 0-indexed

  function goPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay(); // 0=Sunday

  const cells: Array<{ day: number; dateKey: string } | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, dateKey: toDateKey(viewYear, viewMonth, i + 1) })),
  ];

  return (
    <div style={{ maxWidth: 360 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <button type="button" onClick={goPrevMonth} className="btn" style={{ padding: "2px 10px" }}>
          ‹
        </button>
        <strong style={{ fontSize: "var(--text-sm)" }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </strong>
        <button type="button" onClick={goNextMonth} className="btn" style={{ padding: "2px 10px" }}>
          ›
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {WEEKDAY_LABELS.map((wd) => (
          <div key={wd} style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {wd}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />;
          const isSelected = selectedDates.has(cell.dateKey);
          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onToggleDate(cell.dateKey)}
              title={isSelected ? "Remove this date's event(s)" : "Add an event on this date"}
              style={{
                aspectRatio: "1 / 1",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                background: isSelected ? "var(--color-accent-500)" : "var(--surface-raised)",
                color: isSelected ? "#fff" : "var(--text-primary)",
                fontSize: "var(--text-xs)",
                cursor: "pointer",
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
