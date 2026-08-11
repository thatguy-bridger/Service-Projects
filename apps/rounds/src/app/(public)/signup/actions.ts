"use server";

import { headers } from "next/headers";
import {
  submitSignup as submitSignupToDb,
  selfServiceView,
  organizationById,
  organizationSettings,
  type SignupSubmission,
} from "@service-projects/database";
import { rateLimit, clientIpFromHeaders } from "@service-projects/core-auth";

// The address step resolves in the browser via AddressPicker.tsx: Google
// Places/Geocoder when NEXT_PUBLIC_GOOGLE_MAPS_API is set, Nominatim
// (OpenStreetMap, no key) otherwise — instead of a server-round-trip to
// @service-projects/geo's UGRC/mock provider. That geo package and its
// UGRC_API_KEY-backed provider are unused by this screen now, but still
// exist for other territory-related work SPEC.md §9 calls for later.

// This is a public, unauthenticated write with no CAPTCHA or other
// bot-defense in front of it — a script could otherwise flood
// Household/Subscription rows with junk. "RATE_LIMITED:<seconds>" is a
// stable-prefix message (not a thrown custom class — server actions
// don't reliably preserve error subclasses across the client/server
// boundary) that SignupFlow.tsx checks for to show a specific message.
export async function submitSignup(input: SignupSubmission) {
  const ip = clientIpFromHeaders(headers());
  const { allowed, retryAfterSeconds } = rateLimit(`signup:${ip}`, 5, 10 * 60 * 1000);
  if (!allowed) {
    throw new Error(`RATE_LIMITED:${retryAfterSeconds ?? 60}`);
  }
  return submitSignupToDb(input);
}

export interface SendLinkResult {
  ok: boolean;
  error?: string;
}

/**
 * Sends the self-service link for the household identified by `token`
 * — never a client-supplied email or link. The token is re-resolved
 * server-side via selfServiceView (same possession-of-token check the
 * /h/<token> page itself uses), and both the destination email and the
 * link text are derived from that lookup. Without this, a caller could
 * invoke the action directly (bypassing the UI) with an arbitrary
 * email/link pair and use the app's own Resend account as an open
 * phishing relay. Email goes out for real when Resend is configured
 * (same guarded pattern as packages/core-auth's EmailProvider); SMS is
 * a clear "not set up yet" rather than a guess, since no Twilio
 * integration exists anywhere in this app yet (see
 * docs/rounds/OPEN-QUESTIONS.md).
 */
export async function sendSelfServiceLinkAction(input: {
  orgId: string;
  token: string;
  channel: "email" | "sms";
}): Promise<SendLinkResult> {
  const requestHeaders = headers();
  const ip = clientIpFromHeaders(requestHeaders);
  const { allowed, retryAfterSeconds } = rateLimit(`send-link:${ip}`, 5, 10 * 60 * 1000);
  if (!allowed) return { ok: false, error: `Too many attempts — try again in ${retryAfterSeconds ?? 60}s.` };

  const view = await selfServiceView(input.orgId, input.token);
  if (!view) return { ok: false, error: "Link not found or expired." };

  if (input.channel === "sms") {
    return { ok: false, error: "Text messaging isn't set up yet — copy the link instead." };
  }

  // The "From" address is org-configurable (admin/settings) since
  // different orgs on this deployment may have different points of
  // contact — falls back to the deployment-wide EMAIL_FROM when an org
  // hasn't set its own. RESEND_API_KEY (the transport credential) stays
  // a single deployment-wide secret; only the address shown to
  // recipients is per-org.
  const org = await organizationById(input.orgId);
  const from = organizationSettings(org ?? { settings: {} }).emailFrom || process.env.EMAIL_FROM;

  if (!process.env.RESEND_API_KEY || !from) {
    return { ok: false, error: "Email sending isn't configured yet — copy the link instead." };
  }
  if (!view.household.contactEmail) return { ok: false, error: "No email address on file for this signup." };

  const origin =
    process.env.NEXTAUTH_URL ??
    `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? ""}`;
  const link = `${origin}/h/${input.token}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: view.household.contactEmail,
      subject: "Your signup link",
      html: `<p>Here's your link to manage this signup any time:</p><p><a href="${link}">${link}</a></p>`,
    }),
  });
  if (!res.ok) {
    // Resend's actual rejection reason (bad "from" domain, invalid key,
    // etc) never reaches the user — this is a public action and
    // shouldn't leak provider details — but it has to land somewhere,
    // or a misconfigured "from" address fails silently forever.
    const body = await res.text().catch(() => "");
    console.error(`[sendSelfServiceLinkAction] Resend ${res.status}: ${body}`);
    return { ok: false, error: "Couldn't send that email — copy the link instead." };
  }
  return { ok: true };
}
