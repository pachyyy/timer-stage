import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Lets the dev server be reached from another device on the LAN (e.g. testing on a phone at
  // http://192.168.18.203:3000 while `npm run dev` runs on this laptop) — without this, Next's
  // dev-only cross-origin protection blocks requests whose Origin header doesn't match the host
  // it was started on, so hydration/client fetches (like useSession()'s call to
  // /api/auth/session) silently never complete on the phone, leaving the page stuck on its
  // initial server-rendered snapshot (status: 'loading' → the Login/Sign up buttons render as
  // null). Dev-only; has no effect on a production build/deploy. Add any other LAN IP or hostname
  // you test from to this list.
  allowedDevOrigins: ['192.168.18.203'],
};

export default withNextIntl(nextConfig);
