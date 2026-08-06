"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { generateStopsAction } from "./actions";
import type { GenerateStopsResult } from "@service-projects/database";

const initialState: GenerateStopsResult = { created: 0, alreadyExisted: 0 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.eventDetail.stops.generating") : t("admin.eventDetail.stops.generate")}
    </Button>
  );
}

export function GenerateStopsButton({ eventId }: { eventId: string }) {
  const withId = generateStopsAction.bind(null, eventId);
  const [state, formAction] = useFormState(withId, initialState);

  return (
    <form action={formAction}>
      <SubmitButton />
      {(state.created > 0 || state.alreadyExisted > 0) && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          {t("admin.eventDetail.stops.result", { created: state.created, existed: state.alreadyExisted })}
        </p>
      )}
      {state.error && (
        <p className="signup-error" style={{ marginTop: "var(--space-2)" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
