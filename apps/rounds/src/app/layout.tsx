import { Analytics } from "@vercel/analytics/next";
import { defaultOrganization, copyOverridesForOrg } from "@service-projects/database";
import { brand } from "@/config/brand";
import { CopyHydrator } from "@/copy/CopyHydrator";
import { OfflineBanner } from "./OfflineBanner";
import "./globals.css";

export const metadata = {
  title: brand.productName,
};

// This app is fully dynamic already (nearly every screen reads the
// session via getServerSession), so this doesn't change what actually
// gets served -- it just makes the requirement explicit: org copy
// overrides are read fresh from the database on every request, never
// baked into a static/ISR render.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Real org-override resolution for every `t()` call site in the app
  // (see copy/t.ts's setCopyOverrides/CopyHydrator) -- previously the
  // admin/copy editor saved real rows that nothing ever read back. A
  // signed-out visitor (public /signup, /browse) still needs this, so
  // it can't be gated behind a session check the way most other org
  // lookups are.
  const org = await defaultOrganization();
  const overrides = org ? await copyOverridesForOrg(org.id) : {};

  return (
    <html lang="en">
      {/* tokens.css's --font-sans/--font-heading reference "Archivo" by
          name (the Modernist design system) -- loaded here the same way
          Inter was before it, so the App Router's root layout stays the
          one place this lives. */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this
            rule is Pages Router-specific (it wants pages/_document.js,
            which doesn't exist in App Router); the root layout is the
            correct, and only, place for this in App Router. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap"
        />
      </head>
      <body>
        <CopyHydrator overrides={overrides} />
        <OfflineBanner />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
