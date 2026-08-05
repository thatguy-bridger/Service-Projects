import { Analytics } from "@vercel/analytics/next";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata = {
  title: brand.productName,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
