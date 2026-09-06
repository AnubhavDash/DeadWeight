/**
 * The response this app is set against.
 *
 * On 26 August 2026 a glacier-linked debris avalanche in Rasuwa district, on
 * Nepal's border with Tibet, sent a flow roughly 100 km down the Bhotekoshi,
 * Lende Khola and Trishuli rivers. On 4 September 2026 the UN and partners
 * launched a US$49.6 million flash appeal.
 *
 * What is in this file: figures that do not move — the date of the event, the
 * districts, the size and target of the appeal, and the appeal's own list of
 * priorities.
 *
 * What is deliberately NOT in this file: the death and missing toll. Within
 * days of the event, published figures ran 160 → 359 → 538 → 579 → over 1,250
 * with thousands missing, depending on the source and the hour. A number that
 * behaves like that must be fetched live with its timestamp and attribution, or
 * not shown at all.
 *
 * It is not shown at all, and the reason is worth recording rather than glossing.
 * The live route would be ReliefWeb, whose API is free and read-only — but since
 * 1 November 2025 it requires a pre-approved `appname`, and an unapproved one is
 * refused: `GET https://api.reliefweb.int/v2/reports?appname=deadweight.vercel.app`
 * answers `403 AccessDeniedHttpException`, verified 5 September 2026. Approval is
 * a request to ReliefWeb, not a signup, so this build cannot have it in time.
 * Which leaves the two honest options, and hardcoding a moving toll — or worse,
 * regexing one out of a report's prose and printing it in our own voice — would
 * be the exact failure this project is about. So the toll is absent, and the page
 * says so in the place a reader would look for it.
 */

import type { CitationId } from "./citations";

export interface CrisisFact {
  readonly value: string;
  readonly source: CitationId;
  readonly asOf: string;
}

export const CRISIS = {
  name: "Nepal glacial flood response",
  /** Printed in the ledger header. */
  locus: "Rasuwa · 26 Aug 2026",
  eventDate: "2026-08-26",
  country: "Nepal",

  districts: {
    value: "Rasuwa, Nuwakot, Dhading, with impacts reported in Gorkha and Tanahun",
    source: "unicef-nepal-27aug2026",
    asOf: "2026-08-27",
  } satisfies CrisisFact,

  peopleAffected: {
    value: "around 65,000",
    source: "unicef-nepal-27aug2026",
    asOf: "2026-08-27",
  } satisfies CrisisFact,

  childrenAffected: {
    value: "more than 17,000",
    source: "unicef-nepal-27aug2026",
    asOf: "2026-08-27",
  } satisfies CrisisFact,

  childrenNeedingWash: {
    value: "over 22,000",
    source: "unicef-nepal-27aug2026",
    asOf: "2026-08-27",
  } satisfies CrisisFact,

  appeal: {
    launched: "2026-09-04",
    usd: 49_600_000,
    people: 84_000,
    source: "un-nepal-flash-appeal-2026" as CitationId,
    /**
     * In the order the UN published them. Cash is first. That ordering is the
     * single most important fact on this page: the response's own priority list
     * opens with the thing donors are least inclined to send.
     */
    priorities: [
      "direct cash assistance",
      "cold-weather shelter materials",
      "portable solar power units",
      "water purification systems",
      "food aid",
      "emergency mobile clinics",
    ],
  },
} as const;

/**
 * Where money should actually go. The app takes none of it.
 *
 * Every entry is a page that can take a donation, which sounds obvious and was
 * not true of this list before: it opened with four organisation homepages, and
 * a homepage is a place to read about a response rather than a place to fund
 * one. The order is the site's own argument — the further up the list, the more
 * of the dollar is spent inside Nepal by someone who was already there.
 *
 * `source` is set where the note makes a claim a reader should be able to check.
 * It renders as plain text, not a link: the whole tile is already an anchor and
 * an anchor inside an anchor is not valid HTML. The sources page carries the
 * clickable version.
 *
 * Deliberately not linked: the World Food Programme, WHO, Catholic Relief
 * Services, Save the Children, World Vision and Plan International, all of
 * which the New York Times reports are running responses. They are named in the
 * prose instead, because we have not checked a giving page for each of them and
 * a list like this should not imply more verification than it has had.
 */
export const APPEALS: readonly {
  name: string;
  url: string;
  note: string;
  source?: CitationId;
}[] = [
  {
    name: "GlobalGiving Nepal Flood Relief Fund",
    url: "https://www.globalgiving.org/projects/nepal-flood-relief-fund/",
    note: "Flexible grants to Nepali organisations already working in the districts — in-region procurement under another name, which is the whole argument of this page.",
  },
  {
    name: "Prime Minister’s Disaster Relief Fund",
    url: "https://pmdrf.nchl.com.np/",
    note: "Nepal’s own fund, taking cards from anywhere in the world. Spendable by law on rescue, treatment, relief, rehabilitation and infrastructure — not on administration — and audited annually.",
    source: "kathmandu-post-how-to-help-2026",
  },
  {
    name: "IFRC Nepal flash floods appeal",
    url: "https://donate.redcrossredcrescent.org/ifrc/nepal-flash-floods/~my-donation?_cv=1",
    note: "Funds the Nepal Red Cross Society, which was in the affected districts before there was an appeal to write.",
    source: "nyt-nepal-donate-2026",
  },
  {
    name: "UN Nepal flash appeal",
    url: "https://nepal.un.org/en",
    note: "The US$49.6 million appeal of 4 September 2026, cash assistance first. The yardstick the ledger above measures your consignment against.",
    source: "un-nepal-flash-appeal-2026",
  },
  {
    name: "Direct Relief — Nepal flood relief",
    url: "https://www.directrelief.org/emergency/nepal-floods-2026/",
    note: "Medical supply, procured against a request from the field rather than donated in kind.",
  },
  {
    name: "UNICEF Nepal",
    url: "https://www.unicef.org/nepal/",
    note: "Water, sanitation and hygiene for the 22,000+ children reported to need it.",
    source: "unicef-nepal-27aug2026",
  },
];
