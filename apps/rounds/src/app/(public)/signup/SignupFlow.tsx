"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { formatCentsFull, formatCentsShort, formatHolidayDate } from "@/lib/format";
import { geocodeAddress, reverseGeocodeCoords, submitSignup, type AddressGeocodeResult } from "./actions";

// Leaflet touches `window` at import time, so it can never run during
// server rendering — ssr: false is required here, not just a nicety.
const AddressMap = dynamic(() => import("./AddressMap").then((m) => m.AddressMap), { ssr: false });

export interface HolidayOption {
  id: string;
  key: string;
  name: string;
  /** ISO date string — Date objects aren't serializable across the
   * server/client component boundary. */
  date: string;
  priceCents: number;
  mostPopular?: boolean;
}

type Step = "holidays" | "address" | "contact" | "done";

export function SignupFlow({
  orgId,
  orgName,
  seasonId,
  holidays,
}: {
  orgId: string;
  orgName: string;
  seasonId: string;
  holidays: HolidayOption[];
}) {
  const [step, setStep] = useState<Step>("holidays");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [addressInput, setAddressInput] = useState("");
  const [zoneInput, setZoneInput] = useState("");
  const [geo, setGeo] = useState<AddressGeocodeResult | null>(null);
  const [pinAddress, setPinAddress] = useState<string | null>(null);
  const [geocoding, startGeocode] = useTransition();
  const [addressError, setAddressError] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [placementNote, setPlacementNote] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedHolidays = useMemo(() => holidays.filter((h) => selected.has(h.key)), [holidays, selected]);
  const totalCents = useMemo(() => selectedHolidays.reduce((sum, h) => sum + h.priceCents, 0), [selectedHolidays]);

  function toggleHoliday(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function runGeocode(address: string, zone: string) {
    if (!address.trim() || !zone.trim()) {
      setGeo(null);
      setPinAddress(null);
      return;
    }
    startGeocode(async () => {
      const result = await geocodeAddress(address, zone);
      setGeo(result);
      setPinAddress(result?.matchedAddress ?? null);
    });
  }

  function handlePinMove(lat: number, lng: number) {
    setGeo((prev) => (prev ? { ...prev, lat, lng } : prev));
    startGeocode(async () => {
      const address = await reverseGeocodeCoords(lat, lng);
      // null means the provider couldn't confirm an address for this
      // pin (e.g. UgrcProvider.reverseGeocode isn't implemented yet) —
      // keep showing the last known address rather than blanking it.
      if (address) setPinAddress(address);
    });
  }

  function handleAddressContinue() {
    if (!addressInput.trim()) {
      setAddressError(t("signup.address.required"));
      return;
    }
    setAddressError(null);
    setStep("contact");
  }

  function handleSubmit() {
    if (!contactName.trim() || !addressInput.trim()) {
      setSubmitError(t("signup.contact.required"));
      return;
    }
    setSubmitError(null);
    startSubmit(async () => {
      try {
        await submitSignup({
          orgId,
          seasonId,
          eventIds: selectedHolidays.map((h) => h.id),
          amountCents: totalCents,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          addressInput: addressInput.trim(),
          address: geo
            ? { matchedAddress: pinAddress ?? geo.matchedAddress, zone: zoneInput.trim() }
            : { raw: addressInput.trim(), zone: zoneInput.trim() },
          lat: geo?.lat,
          lng: geo?.lng,
          geocodeConfidence: geo?.confidence,
          geocodeSource: geo?.source,
          placementNote: placementNote.trim() || undefined,
          accessNotes: accessNotes.trim() || undefined,
        });
        setStep("done");
      } catch {
        setSubmitError(t("signup.contact.error"));
      }
    });
  }

  const stepIndex = { holidays: 0, address: 1, contact: 2, done: 2 }[step];

  return (
    <div className="signup-shell">
      <div className="signup-header">
        <div className="signup-brandRow">
          <div className="signup-brandMark">{orgName.charAt(0).toUpperCase()}</div>
          <span className="signup-brandName">{orgName}</span>
        </div>
        {step !== "done" && (
          <>
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
          </>
        )}
      </div>

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
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <label className="signup-field" style={{ flex: 2, minWidth: 200 }}>
                <span className="signup-fieldLabel">{t("signup.address.label")}</span>
                <input
                  className="signup-input"
                  type="text"
                  value={addressInput}
                  placeholder={t("signup.address.placeholder")}
                  onChange={(e) => {
                    setAddressInput(e.target.value);
                    runGeocode(e.target.value, zoneInput);
                  }}
                />
              </label>
              <label className="signup-field" style={{ flex: 1, minWidth: 120 }}>
                <span className="signup-fieldLabel">{t("signup.address.zone")}</span>
                <input
                  className="signup-input"
                  type="text"
                  value={zoneInput}
                  placeholder={t("signup.address.zonePlaceholder")}
                  onChange={(e) => {
                    setZoneInput(e.target.value);
                    runGeocode(addressInput, e.target.value);
                  }}
                />
              </label>
            </div>

            {geocoding && <p className="signup-hint">{t("signup.address.locating")}</p>}

            {!geocoding && geo && (
              <>
                <p className="signup-hint">
                  {t("signup.address.approxPin", { confidence: Math.round(geo.confidence * 100) })}
                </p>
                <AddressMap lat={geo.lat} lng={geo.lng} onMove={handlePinMove} />
                {pinAddress && (
                  <p className="signup-hint" style={{ marginTop: "var(--space-2)" }}>
                    {t("signup.address.pinAt", { address: pinAddress })}
                  </p>
                )}
              </>
            )}

            {!geocoding && addressInput.trim() && zoneInput.trim() && !geo && (
              <p className="signup-hint">{t("signup.address.noPin")}</p>
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
                <span className="signup-reviewValue">{pinAddress ?? addressInput}</span>
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
        <div className="signup-intro" style={{ padding: "var(--space-16) var(--space-5)", textAlign: "center" }}>
          <h1>{t("signup.done.title")}</h1>
          <p>{t("signup.done.body", { count: selectedHolidays.length })}</p>
          <a href="/" style={{ color: "var(--color-accent-500)" }}>
            {t("signup.done.backHome")}
          </a>
        </div>
      )}
    </div>
  );
}
