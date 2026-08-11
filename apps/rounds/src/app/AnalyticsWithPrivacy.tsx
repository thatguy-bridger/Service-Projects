"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { redactAnalyticsUrl } from "@/lib/analyticsPrivacy";

// A function prop can't be passed from the server layout into
// <Analytics> directly (Server Components can't hand client components
// a function reference), so this small client wrapper owns the
// beforeSend handler itself instead.
function beforeSend(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: redactAnalyticsUrl(event.url) };
}

export function AnalyticsWithPrivacy() {
  return <Analytics beforeSend={beforeSend} />;
}
