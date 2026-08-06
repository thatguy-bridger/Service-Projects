import { Analytics } from "@vercel/analytics/next";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata = {
  title: brand.productName,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
