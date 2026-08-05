#!/usr/bin/env node
// SPEC.md §11.1: "A CI check fails the build on a key with no default."
// Scans src/ for every t('some.key') call and verifies src/copy/en.ts
// has a default for it. Also warns (non-fatal) about default keys that
// look unused, to catch dead copy before it accumulates.
//
// This is a regex scan, not a real TS parse — it's deliberately simple.
// It will miss a dynamically-built key (`t(someVariable)`), but every
// call site in this app is expected to use a literal key per SPEC.md
// §11.1 ("Never hard-code a user-facing string... every string goes
// through the copy registry as t('dotted.key')"), so a literal-only scan
// matches how the codebase is supposed to use t() anyway.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const srcDir = join(appRoot, "src");

/** @type {string[]} */
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full);
    } else if ([".ts", ".tsx"].includes(extname(full))) {
      files.push(full);
    }
  }
}
walk(srcDir);

const usedKeys = new Set();
const callRe = /\bt\(\s*(['"])([a-zA-Z0-9_.]+)\1/g;
for (const file of files) {
  if (file.includes(`${join("src", "copy")}${"/"}`) || file.endsWith(`${join("copy", "t.ts")}`)) {
    continue; // the t() implementation itself, not a call site
  }
  const text = readFileSync(file, "utf8");
  let m;
  while ((m = callRe.exec(text))) {
    usedKeys.add(m[2]);
  }
}

const enPath = join(srcDir, "copy", "en.ts");
const enText = readFileSync(enPath, "utf8");
const definedKeys = new Set();
const keyRe = /^\s*"([a-zA-Z0-9_.]+)":/gm;
let dm;
while ((dm = keyRe.exec(enText))) {
  definedKeys.add(dm[1]);
}

const missing = [...usedKeys].filter((k) => !definedKeys.has(k)).sort();
const unused = [...definedKeys].filter((k) => !usedKeys.has(k)).sort();

if (unused.length > 0) {
  console.warn(`[check-copy-keys] ${unused.length} default(s) with no call site found (may be used dynamically, or genuinely dead):`);
  for (const k of unused) console.warn(`  - ${k}`);
}

if (missing.length > 0) {
  console.error(`[check-copy-keys] ${missing.length} key(s) used in t() with no default in src/copy/en.ts:`);
  for (const k of missing) console.error(`  - ${k}`);
  console.error("\nAdd a default for each key above in src/copy/en.ts.");
  process.exit(1);
}

console.log(`[check-copy-keys] OK — ${usedKeys.size} key(s) used, all have defaults.`);
