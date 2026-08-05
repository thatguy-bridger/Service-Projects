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
 * Builds a `t()` bound to a set of org/event overrides layered on top of
 * the code defaults — SPEC.md §11.1's resolution order. Nothing calls
 * this with real overrides yet (the copy editor and its UiCopy-backed
 * loader ship in Phase 8); `t` below is `createT()` with no overrides,
 * i.e. defaults only, which is the correct behavior until then.
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

export const t = createT();
