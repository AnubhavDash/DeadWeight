import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
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

const SITE = "https://deadweight.vercel.app";

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
        {children}
      </body>
    </html>
  );
}
