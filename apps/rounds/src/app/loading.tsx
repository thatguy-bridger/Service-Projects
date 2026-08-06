import { t } from "@/copy";

// Root-level fallback for every route that doesn't have its own
// loading.tsx (home, welcome, register) — before this, all three
// rendered a blank white page during their session fetch.
export default function RootLoading() {
  return (
    <main className="rounds-shell" aria-busy="true" aria-live="polite">
      <p style={{ color: "var(--text-secondary)" }}>{t("app.loading")}</p>
    </main>
  );
}
