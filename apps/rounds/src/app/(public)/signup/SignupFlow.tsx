"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { formatCentsFull, formatCentsShort, formatHolidayDate } from "@/lib/format";
import { submitSignup } from "./actions";
import { AddressPicker, type PlaceResult } from "@/components/address/AddressPicker";

export interface HolidayOption {
  id: string;
  key: string;
  name: string;
  /** ISO date string — Date objects aren't serializable across the
   * server/client component boundary. */
  date: string;
  priceCents: number;
  categoryId: string | null;
  /** Set on every event that shares a category with one -- when set,
   * selecting any subset of that category's events charges this flat
   * price once instead of summing each event's own priceCents. */
  categoryBundlePriceCents: number | null;
  mostPopular?: boolean;
}

type Step = "holidays" | "address" | "contact" | "done";

export interface InitialHousehold {
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  placementNote: string | null;
  accessNotes: string | null;
  addressInput: string;
  lat: number | null;
  lng: number | null;
}

export function SignupFlow({
  orgId,
  holidays,
  signedIn = false,
  userId,
  initialHousehold,
}: {
  orgId: string;
  holidays: HolidayOption[];
  signedIn?: boolean;
  userId?: string;
  initialHousehold?: InitialHousehold | null;
}) {
  const [step, setStep] = useState<Step>("holidays");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Prefilled from the signed-in household's last linked record, if any
  // — a returning, account-linked household doesn't retype this.
  const [place, setPlace] = useState<PlaceResult | null>(
    initialHousehold
      ? { address: initialHousehold.addressInput, lat: initialHousehold.lat, lng: initialHousehold.lng }
      : null
  );
  const [addressError, setAddressError] = useState<string | null>(null);

  const [contactName, setContactName] = useState(initialHousehold?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initialHousehold?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initialHousehold?.contactPhone ?? "");
  const [placementNote, setPlacementNote] = useState(initialHousehold?.placementNote ?? "");
  const [accessNotes, setAccessNotes] = useState(initialHousehold?.accessNotes ?? "");
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedHouseholdId, setSubmittedHouseholdId] = useState<string | null>(null);
  const [selfServiceLink, setSelfServiceLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const selectedHolidays = useMemo(() => holidays.filter((h) => selected.has(h.key)), [holidays, selected]);

  // Bundle-aware total: any category with a flat bundle price charges
  // that price once for however many of its events are selected;
  // everything else (uncategorized, or a category with no bundle price
  // set) just sums each selected event's own priceCents.
  const totalCents = useMemo(() => {
    const byCategory = new Map<string, HolidayOption[]>();
    let sum = 0;
    for (const h of selectedHolidays) {
      if (h.categoryId) {
        const group = byCategory.get(h.categoryId) ?? [];
        group.push(h);
        byCategory.set(h.categoryId, group);
      } else {
        sum += h.priceCents;
      }
    }
    for (const group of byCategory.values()) {
      const bundlePrice = group[0].categoryBundlePriceCents;
      sum += bundlePrice !== null ? bundlePrice : group.reduce((s, h) => s + h.priceCents, 0);
    }
    return sum;
  }, [selectedHolidays]);

  // Only set when every selected event shares exactly one category --
  // a mixed selection across categories (or none at all) leaves this
  // null, and the Subscription is created without a bundle FK.
  const selectionCategoryId = useMemo(() => {
    const ids = new Set(selectedHolidays.map((h) => h.categoryId).filter((id): id is string => id !== null));
    return ids.size === 1 ? [...ids][0] : null;
  }, [selectedHolidays]);

  function toggleHoliday(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleAddressContinue() {
    if (!place || !place.address.trim()) {
      setAddressError(t("signup.address.required"));
      return;
    }
    setAddressError(null);
    setStep("contact");
  }

  function handleSubmit() {
    if (!contactName.trim() || !place || !place.address.trim()) {
      setSubmitError(t("signup.contact.required"));
      return;
    }
    setSubmitError(null);
    startSubmit(async () => {
      try {
        const result = await submitSignup({
          orgId,
          categoryId: selectionCategoryId,
          eventIds: selectedHolidays.map((h) => h.id),
          amountCents: totalCents,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          userId,
          addressInput: place.address,
          address: { matchedAddress: place.address },
          lat: place.lat ?? undefined,
          lng: place.lng ?? undefined,
          geocodeSource:
            place.lat === null || place.lng === null
              ? "manual"
              : process.env.NEXT_PUBLIC_GOOGLE_MAPS_API
                ? "google"
                : "osm",
          placementNote: placementNote.trim() || undefined,
          accessNotes: accessNotes.trim() || undefined,
        });
        setSubmittedHouseholdId(result.householdId);
        setSelfServiceLink(`${window.location.origin}/h/${result.selfServiceToken}`);
        setStep("done");
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        setSubmitError(
          message.startsWith("RATE_LIMITED:") ? t("signup.contact.rateLimited") : t("signup.contact.error")
        );
      }
    });
  }

  const stepIndex = { holidays: 0, address: 1, contact: 2, done: 2 }[step];

  return (
    <div className="signup-shell">
      {step !== "done" && (
        <div className="signup-header">
          <div className="signup-stepperTrack">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`signup-stepperFill${i <= stepIndex ? " signup-stepperFill--active" : ""}`} />
            ))}
          </div>
          <div className="signup-stepperLabels">
            <span className={stepIndex === 0 ? "signup-stepperLabel--active" : undefined}>
              {t("signup.stepper.holidays")}
            </span>
            <span className={stepIndex === 1 ? "signup-stepperLabel--active" : undefined}>
              {t("signup.stepper.address")}
            </span>
            <span className={stepIndex === 2 ? "signup-stepperLabel--active" : undefined}>
              {t("signup.stepper.pay")}
            </span>
          </div>
        </div>
      )}

      {step === "holidays" && (
        <>
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
                  onClick={() => toggleHoliday(h.key)}
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
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={selected.size === 0}
              onClick={() => setStep("address")}
            >
              {t("signup.holidays.continue")}
            </Button>
          </div>
        </>
      )}

      {step === "address" && (
        <>
          <div className="signup-intro">
            <h1>{t("signup.address.title")}</h1>
            <p>{t("signup.address.subtitle")}</p>
          </div>

          <div className="signup-list">
            <label className="signup-field">
              <span className="signup-fieldLabel">{t("signup.address.label")}</span>
              <AddressPicker place={place} onSelect={setPlace} onMove={setPlace} />
            </label>

            {place && place.lat !== null && (
              <p className="signup-hint" style={{ marginTop: "var(--space-2)" }}>
                {t("signup.address.pinAt", { address: place.address })}
              </p>
            )}

            {addressError && <p className="signup-error">{addressError}</p>}
          </div>

          <div className="signup-footer">
            <Button type="button" variant="secondary" onClick={() => setStep("holidays")}>
              {t("signup.address.back")}
            </Button>
            <Button type="button" variant="primary" size="lg" onClick={handleAddressContinue}>
              {t("signup.address.continue")}
            </Button>
          </div>
        </>
      )}

      {step === "contact" && (
        <>
          <div className="signup-intro">
            <h1>{t("signup.contact.title")}</h1>
            <p>{t("signup.contact.subtitle")}</p>
          </div>

          <div className="signup-list">
            <label className="signup-field">
              <span className="signup-fieldLabel">{t("signup.contact.name")}</span>
              <input className="signup-input" type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
            <label className="signup-field">
              <span className="signup-fieldLabel">{t("signup.contact.email")}</span>
              <input className="signup-input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </label>
            <label className="signup-field">
              <span className="signup-fieldLabel">{t("signup.contact.phone")}</span>
              <input className="signup-input" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </label>
            <label className="signup-field">
              <span className="signup-fieldLabel">{t("signup.contact.placementNote")}</span>
              <input
                className="signup-input"
                type="text"
                placeholder={t("signup.contact.placementNotePlaceholder")}
                value={placementNote}
                onChange={(e) => setPlacementNote(e.target.value)}
              />
            </label>
            <label className="signup-field">
              <span className="signup-fieldLabel">{t("signup.contact.accessNotes")}</span>
              <textarea
                className="signup-input"
                rows={2}
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
              />
            </label>

            <div className="signup-reviewBox">
              <h2 className="signup-reviewTitle">{t("signup.contact.reviewTitle")}</h2>
              <div className="signup-reviewRow">
                <span className="signup-reviewLabel">{t("signup.contact.reviewHolidays")}</span>
                <span className="signup-reviewValue">{selectedHolidays.map((h) => h.name).join(", ")}</span>
              </div>
              <div className="signup-reviewRow">
                <span className="signup-reviewLabel">{t("signup.contact.reviewAddress")}</span>
                <span className="signup-reviewValue">{place?.address}</span>
              </div>
              <div className="signup-reviewRow">
                <span className="signup-reviewLabel">{t("signup.contact.reviewTotal")}</span>
                <span className="signup-reviewValue">{formatCentsFull(totalCents)}</span>
              </div>
            </div>

            <p className="signup-hint">{t("signup.contact.paymentNote")}</p>

            {submitError && <p className="signup-error">{submitError}</p>}
          </div>

          <div className="signup-footer">
            <Button type="button" variant="secondary" onClick={() => setStep("address")} disabled={submitting}>
              {t("signup.contact.back")}
            </Button>
            <Button type="button" variant="primary" size="lg" onClick={handleSubmit} disabled={submitting}>
              {submitting ? t("signup.contact.submitting") : t("signup.contact.submit")}
            </Button>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="signup-intro" style={{ padding: "var(--space-12) var(--space-5)", textAlign: "center" }}>
          <h1>{t("signup.done.title")}</h1>
          <p>{t("signup.done.body", { count: selectedHolidays.length })}</p>

          {selfServiceLink && (
            <div className="signup-reviewBox" style={{ textAlign: "left" }}>
              <h2 className="signup-reviewTitle">{t("signup.done.selfService.title")}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-3)" }}>
                {t("signup.done.selfService.body")}
              </p>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  className="signup-input"
                  readOnly
                  value={selfServiceLink}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{ flex: 1, minWidth: 220 }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(selfServiceLink).then(() => {
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    });
                  }}
                >
                  {linkCopied ? t("signup.done.selfService.copied") : t("signup.done.selfService.copy")}
                </Button>
              </div>
            </div>
          )}

          {!signedIn && submittedHouseholdId && (
            <div className="signup-accountCta">
              <h2 className="signup-accountCtaTitle">{t("signup.done.accountCta.title")}</h2>
              <p className="signup-accountCtaBody">{t("signup.done.accountCta.body")}</p>
              <a
                href={`/register?${new URLSearchParams({
                  householdId: submittedHouseholdId,
                  email: contactEmail.trim(),
                  name: contactName.trim(),
                  next: "/",
                }).toString()}`}
              >
                <Button type="button" variant="primary">
                  {t("signup.done.accountCta.cta")}
                </Button>
              </a>
              <p className="signup-accountCtaSkip">
                <a href="/" style={{ color: "var(--text-secondary)" }}>
                  {t("signup.done.accountCta.skip")}
                </a>
              </p>
            </div>
          )}

          {(signedIn || !submittedHouseholdId) && (
            <a href="/" style={{ color: "var(--color-accent-500)" }}>
              {t("signup.done.backHome")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
