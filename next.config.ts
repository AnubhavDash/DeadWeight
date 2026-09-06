import type { NextConfig } from "next";

/**
 * There is deliberately no `vercel.json` in this repository.
 *
 * Next.js on Vercel is zero-config: the framework is detected, the build and
 * install commands are inferred, and every route in `app/` is wired up without
 * being declared anywhere. A `vercel.json` that restated those defaults would be
 * a second place for the truth to live and a first place for it to drift. The
 * one thing it would plausibly have carried is response headers — and those
 * belong here instead, because `next.config.ts` applies them in `next dev` and
 * `next start` too, so what ships is what was tested locally. A header set that
 * only exists on the platform is a header set nobody ever sees fail.
 *
 * What is not here: a Content-Security-Policy. Doing one properly for this app
 * means a per-request nonce for React's inline bootstrap plus allowances for the
 * WebGL shaders and the Solana RPC, and a CSP that is wrong is worse than none —
 * it either blocks the page or lulls you with a policy full of `unsafe-inline`.
 * The four headers below need no per-request state and cannot break a render.
 */
const SECURITY_HEADERS = [
  // Sniffing is how a text response gets executed as something else.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nothing on this site is meant to be framed; there is no embed story.
  { key: "X-Frame-Options", value: "DENY" },
  // Send the origin cross-site, the full path only same-site. A referrer is not
  // sensitive here, but the default varies by browser and this pins it.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app asks for no device permissions. Say so, so an injected script
  // cannot ask on its behalf.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
