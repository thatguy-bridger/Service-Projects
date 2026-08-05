"use client";

import { useMemo, useState } from "react";
import { Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { formatCentsFull, formatCentsShort, formatHolidayDate } from "@/lib/format";

export interface HolidayOption {
  key: string;
  name: string;
  /** ISO date string — Date objects aren't serializable across the
   * server/client component boundary. */
  date: string;
  priceCents: number;
  mostPopular?: boolean;
}

export function HolidayPicker({ orgName, holidays }: { orgName: string; holidays: HolidayOption[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const totalCents = useMemo(
    () => holidays.filter((h) => selected.has(h.key)).reduce((sum, h) => sum + h.priceCents, 0),
    [holidays, selected]
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="signup-shell">
      <div className="signup-header">
        <div className="signup-brandRow">
          <div className="signup-brandMark">{orgName.charAt(0).toUpperCase()}</div>
          <span className="signup-brandName">{orgName}</span>
        </div>
        <div className="signup-stepperTrack">
          <div className="signup-stepperFill signup-stepperFill--active" />
          <div className="signup-stepperFill" />
          <div className="signup-stepperFill" />
        </div>
        <div className="signup-stepperLabels">
          <span className="signup-stepperLabel--active">{t("signup.stepper.holidays")}</span>
          <span>{t("signup.stepper.address")}</span>
          <span>{t("signup.stepper.pay")}</span>
        </div>
      </div>

      <div className="signup-intro">
        <h1>{t("signup.holidays.title")}</h1>
        <p>{t("signup.holidays.subtitle")}</p>
      </div>

      <div className="signup-list">
        {holidays.map((h) => {
          const isSelected = selected.has(h.key);
          return (
            <button
              key={h.key}
              type="button"
              className={`signup-holidayCard${isSelected ? " signup-holidayCard--selected" : ""}`}
              aria-pressed={isSelected}
              onClick={() => toggle(h.key)}
            >
              <span className={`signup-checkbox${isSelected ? " signup-checkbox--selected" : ""}`}>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span className="signup-holidayText">
                <span className="signup-holidayNameRow">
                  <span className="signup-holidayName">{h.name}</span>
                  {h.mostPopular && <Badge tone="accent">{t("signup.holidays.mostPopular")}</Badge>}
                </span>
                <span className="signup-holidayDate">{formatHolidayDate(new Date(h.date))}</span>
              </span>
              <span className="signup-holidayPrice">{formatCentsShort(h.priceCents)}</span>
            </button>
          );
        })}
      </div>

      <div className="signup-footer">
        <div className="signup-footerTotals">
          <span className="signup-footerPrice">{formatCentsFull(totalCents)}</span>
          <span className="signup-footerCount">
            {t("signup.holidays.selectedCount", { count: selected.size })}
          </span>
        </div>
        <Button type="button" variant="primary" size="lg" disabled={selected.size === 0}>
          {t("signup.holidays.continue")}
        </Button>
      </div>
    </div>
  );
}
