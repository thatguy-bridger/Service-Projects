/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Server Actions default to a 1MB request body cap -- fine for
    // every form in this app except one: /admin/address-points'
    // import, which hands a whole city-sized address-point file
    // (newline-delimited GeoJSON or CSV, tens of MB) to a server
    // action in one call. Raised just enough to cover a real county
    // export without leaving it unbounded.
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async headers() {
    // Baseline hardening with no impact on how the app works — none of
    // this is a product decision, it's just closing default gaps every
    // Next.js app has out of the box. Deliberately NOT included: a
    // Content-Security-Policy. This app loads scripts from Google Maps
    // and tiles from OpenStreetMap (see AddressPicker.tsx), and a CSP
    // strict enough to matter has to enumerate every one of those
    // origins correctly or it silently breaks the address picker — that
    // needs to be built and tested deliberately, not guessed at here.
    return [
      {
        source: "/:path*",
        headers: [
          // Stops a browser from guessing a response's content-type
          // (e.g. treating a JSON response as executable script).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Blocks this app from being framed by another site —
          // nothing here needs to render inside someone else's iframe,
          // and a framed /admin page is a clickjacking vector.
          { key: "X-Frame-Options", value: "DENY" },
          // Sends the full URL as a referrer only to this app's own
          // origin; other origins get just the scheme+host, not the
          // full path (which could contain a self-service token or
          // signup details in a query string).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
