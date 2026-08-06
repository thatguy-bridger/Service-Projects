"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button, Card, Badge } from "@service-projects/ui";
import { t } from "@/copy";
import { formatHolidayDate } from "@/lib/format";
import { AddressPicker, type PlaceResult } from "@/components/address/AddressPicker";
import {
  updateNotesAction,
  updateAddressAction,
  toggleSkipAction,
  cancelSubscriptionAction,
} from "./actions";
import type { SelfServiceResult, SelfServiceView } from "@service-projects/database";

const initialState: SelfServiceResult = { ok: false };

function SaveNotesButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? t("selfService.saving") : t("selfService.save")}
    </Button>
  );
}

function AddressSection({ token, addressInput }: { token: string; addressInput: string }) {
  const [editing, setEditing] = useState(false);
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SelfServiceResult | null>(null);

  function save() {
    if (!place || !place.address.trim()) return;
    const source = place.lat !== null ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API ? "google" : "osm") : "manual";
    startTransition(async () => {
      const r = await updateAddressAction(token, place.address, place.lat, place.lng, source);
      setResult(r);
      if (r.ok) setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {t("selfService.address.label")}
          </span>
          <p style={{ margin: "4px 0 0" }}>{addressInput}</p>
        </div>
        <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
          {t("selfService.address.change")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="signup-hint" style={{ marginTop: 0 }}>{t("selfService.address.reviewNote")}</p>
      <AddressPicker place={place} onSelect={setPlace} onMove={setPlace} />
      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
        <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={pending}>
          {t("selfService.address.cancel")}
        </Button>
        <Button type="button" variant="primary" onClick={save} disabled={pending || !place}>
          {pending ? t("selfService.saving") : t("selfService.save")}
        </Button>
      </div>
      {result?.error && <p className="signup-error">{result.error}</p>}
      {result?.ok && <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)" }}>{t("selfService.address.saved")}</p>}
    </div>
  );
}

function HolidayToggle({ token, subscriptionEventId, name, date, skipped }: { token: string; subscriptionEventId: string; name: string; date: Date; skipped: boolean }) {
  const [pending, startTransition] = useTransition();
  const [localSkipped, setLocalSkipped] = useState(skipped);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-sunken)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: "var(--weight-medium)" as unknown as number }}>{name}</span>
        <span style={{ color: "var(--text-secondary)", marginLeft: "var(--space-2)", fontSize: "var(--text-sm)" }}>
          {formatHolidayDate(date)}
        </span>
      </div>
      {localSkipped && <Badge tone="neutral">{t("selfService.skipped")}</Badge>}
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const next = !localSkipped;
            const r = await toggleSkipAction(token, subscriptionEventId, next);
            if (r.ok) setLocalSkipped(next);
          })
        }
      >
        {localSkipped ? t("selfService.undoSkip") : t("selfService.skipThisOne")}
      </Button>
    </div>
  );
}

function CancelButton({ token, subscriptionId }: { token: string; subscriptionId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) {
    return <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{t("selfService.cancelled")}</p>;
  }

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
        {t("selfService.cancelSubscription")}
      </Button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-danger-500)" }}>{t("selfService.cancelConfirm")}</span>
      <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
        {t("selfService.address.cancel")}
      </Button>
      <Button
        type="button"
        variant="danger"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await cancelSubscriptionAction(token, subscriptionId);
            if (r.ok) setCancelled(true);
          })
        }
      >
        {pending ? t("selfService.saving") : t("selfService.cancelReally")}
      </Button>
    </div>
  );
}

export function SelfServiceForm({ token, view }: { token: string; view: SelfServiceView }) {
  const withToken = updateNotesAction.bind(null, token);
  const [notesState, notesFormAction] = useFormState(withToken, initialState);

  return (
    <>
      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
          {t("selfService.address.title")}
        </h2>
        <AddressSection token={token} addressInput={view.household.addressInput} />
      </Card>

      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
          {t("selfService.notes.title")}
        </h2>
        <form action={notesFormAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <label className="signup-field" style={{ marginBottom: 0 }}>
            <span className="signup-fieldLabel">{t("signup.contact.placementNote")}</span>
            <input className="signup-input" name="placementNote" defaultValue={view.household.placementNote ?? ""} />
          </label>
          <label className="signup-field" style={{ marginBottom: 0 }}>
            <span className="signup-fieldLabel">{t("signup.contact.accessNotes")}</span>
            <textarea className="signup-input" name="accessNotes" rows={2} defaultValue={view.household.accessNotes ?? ""} />
          </label>
          <div>
            <SaveNotesButton />
          </div>
          {notesState.ok && <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)" }}>{t("selfService.saved")}</p>}
          {notesState.error && <p className="signup-error">{notesState.error}</p>}
        </form>
      </Card>

      {view.subscriptions.map((sub) => (
        <Card key={sub.subscriptionId} style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
              {sub.label}
            </h2>
            {sub.cancelledAt ? (
              <Badge tone="neutral">{t("selfService.cancelled")}</Badge>
            ) : (
              <Badge tone="accent">{sub.status}</Badge>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            {sub.holidays.map((h) => (
              <HolidayToggle
                key={h.subscriptionEventId}
                token={token}
                subscriptionEventId={h.subscriptionEventId}
                name={h.eventName}
                date={h.serviceStartsAt}
                skipped={h.skipped}
              />
            ))}
          </div>

          {!sub.cancelledAt && <CancelButton token={token} subscriptionId={sub.subscriptionId} />}
        </Card>
      ))}
    </>
  );
}
