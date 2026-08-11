import { en } from "./en";

type Vars = Record<string, string | number>;

// Minimal ICU plural subset: {count, plural, one {# stop} other {# stops}}.
// Stop counts are everywhere in this app (SPEC.md §11.1 calls this out
// specifically), so this is worth having correct from day one rather than
// hand-pluralizing strings.
function applyPlural(template: string, vars: Vars): string {
  return template.replace(
    /\{(\w+),\s*plural,\s*((?:\w+\s*\{[^}]*\}\s*)+)\}/g,
    (_match, varName: string, branchesRaw: string) => {
      const raw = vars[varName];
      const n = typeof raw === "number" ? raw : Number(raw);
      const branches: Record<string, string> = {};
      const branchRe = /(\w+)\s*\{([^}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = branchRe.exec(branchesRaw))) {
        branches[m[1]] = m[2];
      }
      const category = n === 1 ? "one" : "other";
      const chosen = branches[category] ?? branches.other ?? "";
      return chosen.replace(/#/g, String(n));
    }
  );
}

function applyVars(template: string, vars?: Vars): string {
  if (!vars) return template;
  let out = applyPlural(template, vars);
  out = out.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
  return out;
}

const defaults: Record<string, string> = en;

/**
 * Builds a `t()` bound to a fixed set of org/event overrides layered on
 * top of the code defaults — SPEC.md §11.1's resolution order. Useful
 * standalone (e.g. a script rendering copy outside a request), but the
 * app's real call sites all use the singleton `t` below instead.
 */
export function createT(overrides: Partial<Record<string, string>> = {}) {
  return function t(key: string, vars?: Vars): string {
    const template = overrides[key] ?? defaults[key];
    if (template === undefined) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[copy] "${key}" has no default in src/copy/en.ts`);
      }
      return key;
    }
    return applyVars(template, vars);
  };
}

// The app's real org-override resolution. This app is single-org per
// deployment (resolveMembership's OWNER/ADMIN org-wide shortcut already
// bakes that assumption in), so overrides aren't a per-request-varying
// value the way session/auth state is -- they're closer to slowly-
// changing global config, safe to hold as module state rather than
// threading through every one of the ~30 call sites that already do
// `import { t } from "@/copy"` and call it directly during render
// (including client-side, inside event handlers). CopyHydrator (a tiny
// client component rendered once in the root layout) is the one place
// that calls setCopyOverrides, with the org's current UiCopyOverride
// rows fetched fresh server-side on every request.
let overridesStore: Record<string, string> = {};

export function setCopyOverrides(next: Record<string, string>): void {
  overridesStore = next;
}

export function t(key: string, vars?: Vars): string {
  const template = overridesStore[key] ?? defaults[key];
  if (template === undefined) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[copy] "${key}" has no default in src/copy/en.ts`);
    }
    return key;
  }
  return applyVars(template, vars);
}
