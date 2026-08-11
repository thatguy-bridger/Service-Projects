// SPEC.md §20: "Analytics never receive addresses, names, emails or
// coordinates. Configure the denylist explicitly and write a test for
// it." No custom analytics event ever sends properties in this app
// (grep for `track(` turns up nothing), so the one real leak vector is
// automatic page-view tracking sending the URL itself -- and two routes
// put a real secret directly in the path: the self-service token
// (/h/<token>, a 400-day credential to a household's address/contact
// info) and an invite code (/redeem/<code>). Wired into <Analytics
// beforeSend> in layout.tsx. Query strings are dropped outright since
// nothing in this app has a legitimate reason to put data in one.
const SENSITIVE_PATH_PREFIXES: { prefix: string; replacement: string }[] = [
  { prefix: "/h/", replacement: "/h/[redacted]" },
  { prefix: "/redeem/", replacement: "/redeem/[redacted]" },
];

export function redactAnalyticsUrl(url: string): string {
  const path = url.split("?")[0];
  for (const { prefix, replacement } of SENSITIVE_PATH_PREFIXES) {
    if (path.startsWith(prefix) && path.length > prefix.length) return replacement;
  }
  return path;
}
