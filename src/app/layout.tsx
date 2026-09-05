import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

// Archivo carries a width axis, so the display face can be condensed without
// shipping a second family. font-stretch: 75% is applied in globals.css.
const display = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

// Every figure in the app is set in this, with tabular numerals, so columns of
// dollar amounts line up the way they would on a printed manifest.
const ledger = JetBrains_Mono({
  variable: "--font-ledger",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The canonical origin, read rather than typed. `metadataBase` is what every
 * relative OG and Twitter image resolves against, so a stale value here does not
 * throw — it silently serves social previews that point at a host that is not
 * ours. This one has already moved once, from `deadweight` to `deadweight-jet`,
 * which is the argument for not hardcoding it: Vercel sets
 * `VERCEL_PROJECT_PRODUCTION_URL` to the project's production domain (host only,
 * no scheme) on every deployment including previews, so a rename fixes itself.
 * The literal is the local fallback and the current production host.
 */
const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://deadweight-jet.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Deadweight — price your generosity before you ship it",
    template: "%s · Deadweight",
  },
  description:
    "Generosity is worth protecting from waste. Deadweight converts a proposed in-kind donation into the dollars that actually reach the Nepal glacial flood response — freight, sorting and disposal included — and shows you what the same money does as cash.",
  applicationName: "Deadweight",
  authors: [{ name: "an0n99x" }],
  keywords: [
    "in-kind donation",
    "humanitarian logistics",
    "second disaster",
    "Nepal floods 2026",
    "cash transfer programming",
    "disaster relief",
  ],
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Deadweight",
    title: "Deadweight — price your generosity before you ship it",
    description:
      "The blanket you want to send costs more to fly than the blanket is worth. Deadweight does that arithmetic in public, in USD, with every rate sourced.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Deadweight — price your generosity before you ship it",
    description:
      "A deterministic logistics engine that converts a proposed in-kind disaster donation into its real delivered dollar value.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${ledger.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-silt text-paper">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
