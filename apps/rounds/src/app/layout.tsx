import { Analytics } from "@vercel/analytics/next";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata = {
  title: brand.productName,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* tokens.css's --font-sans references "Inter" by name (see
          docs/design-language.md); nothing in the repo loaded the actual
          webfont before this, in either app — without it every app falls
          back to the system UI stack silently. Matches the Google Fonts
          URL the design bundle's own reference HTML uses. */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this
            rule is Pages Router-specific (it wants pages/_document.js,
            which doesn't exist in App Router); the root layout is the
            correct, and only, place for this in App Router. Confirmed
            working via document.fonts.check('16px Inter') in a live
            browser, not just "should work". */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
