import { t } from "@/copy";

// Shown while page.tsx fetches the org/season/events — before this,
// /signup rendered nothing but blank white during that fetch, on a
// screen a household is filling out on a phone with a spotty signal.
export default function SignupLoading() {
  return (
    <div className="signup-shell" aria-busy="true" aria-live="polite">
      <div className="signup-intro" style={{ padding: "var(--space-16) var(--space-5)", textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>{t("signup.loading")}</p>
      </div>
    </div>
  );
}
