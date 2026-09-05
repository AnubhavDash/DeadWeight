/**
 * The source registry.
 *
 * Every rate, fraction and crisis figure in Deadweight points at an entry here
 * by id. Nothing numeric may exist in this codebase without one. When a ledger
 * line is expanded in the UI, this is what it expands into — the title, the
 * publisher, the date, and where possible the sentence the number came out of,
 * so a reader can go and check the arithmetic against the source themselves.
 *
 * `retrieval` records how honestly we came by the text:
 *   primary   — the document was fetched and read.
 *   secondary — a named third party reports the figure from a study.
 *   snippet   — the host refused automated retrieval (403); the quote is from a
 *               search index and has not been read in context. Treated as the
 *               weakest form of evidence and surfaced as such in the UI.
 *
 * Nothing here is a moving number. Death tolls, appeal coverage and exchange
 * rates move, so they are either not shown at all or carry an explicit `asOf` at
 * the point of use — never baked into a rate table. See the note in `crisis.ts`
 * on the toll, which is the clearest case of the first kind.
 */

export type CitationId =
  | "worldbank-airfreight-2009"
  | "irc-freight-spike-2026"
  | "airlink-inappropriate-60"
  | "pom-2022-sustainable-humops"
  | "ucla-anderson-2022"
  | "ifrc-disasterlaw-vanuatu"
  | "ocha-unsolicited-goods"
  | "logcluster-unsolicited"
  | "nhc-second-disaster"
  | "usaid-cidi-calculator"
  | "usaid-modalities"
  | "state-dept-cash-is-best"
  | "irc-nfi-cost-efficiency"
  | "calp-frld-2025"
  | "dfid-cash-cost-effectiveness"
  | "alnap-cash-efficiency-2015"
  | "nepal-minimum-wage-2025"
  | "nh-des-textile-disposal"
  | "wrap-textiles-2025"
  | "nist-textile-reuse"
  | "cdc-infant-formula-donations"
  | "unhcr-bms-sop"
  | "unicef-bms-technical-note"
  | "un-nepal-flash-appeal-2026"
  | "unicef-nepal-27aug2026";

export interface Citation {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  /** ISO date or `YYYY-MM` for the source document itself. */
  readonly published: string;
  /** The sentence the figure is taken from, where one can be quoted briefly. */
  readonly quote?: string;
  readonly retrieval: "primary" | "secondary" | "snippet";
}

export const CITATIONS: Readonly<Record<CitationId, Citation>> = {
  /* --- Freight ---------------------------------------------------------- */

  "worldbank-airfreight-2009": {
    title: "Air Freight: A Market Study with Implications for Landlocked Countries",
    publisher: "World Bank",
    url: "https://www.worldbank.org/en/topic/transport/publication/air-freight-study",
    published: "2009-08",
    quote:
      "Air freight rates generally range from $1.50–$4.50 per kilogram … 4–5 times that of road transport and 12–16 times that of sea transport.",
    retrieval: "primary",
  },

  "irc-freight-spike-2026": {
    title:
      "Two months into Iran war, IRC operational costs spike by up to 50% as fuel prices rise and aid routes collapse",
    publisher: "International Rescue Committee",
    url: "https://www.rescue.org/press-release/two-months-iran-war-irc-operational-costs-spike-50-fuel-prices-rise-and-aid-routes",
    published: "2026",
    quote: "Air freight costs are up 40-62% since last year.",
    retrieval: "secondary",
  },

  /* --- How much of an unsolicited donation is actually wanted ----------- */

  "airlink-inappropriate-60": {
    title: "Why cash is better than in-kind donations",
    publisher: "Airlink",
    url: "https://airlinkflight.org/",
    published: "2023",
    quote:
      "60 percent of the goods that arrive during emergencies are not needed or appropriate for the recovery or the region.",
    retrieval: "snippet",
  },

  "pom-2022-sustainable-humops": {
    title: "Sustainable Humanitarian Operations: An Integrated Perspective",
    publisher:
      "Charles J. Corbett (UCLA Anderson), Alfonso J. Pedraza-Martinez (Indiana University), Luk N. Van Wassenhove (INSEAD) — Production and Operations Management",
    url: "https://anderson-review.ucla.edu/can-humanitarian-aid-turn-wastefulness-to-sustainability/",
    published: "2022",
    quote:
      "Only about 10% of unsolicited donations are considered high priority while 60% can be 'completely useless'.",
    retrieval: "secondary",
  },

  "ucla-anderson-2022": {
    title: "Can Humanitarian Aid Turn Wastefulness to Sustainability?",
    publisher: "UCLA Anderson Review",
    url: "https://anderson-review.ucla.edu/can-humanitarian-aid-turn-wastefulness-to-sustainability/",
    published: "2022",
    quote:
      "750 tons of bottled water was left unused [Tōhoku, 2011] … [Haiti, 2010] less than 2% of the support had reached intended beneficiaries.",
    retrieval: "primary",
  },

  "ifrc-disasterlaw-vanuatu": {
    title: "Unsolicited bilateral donations and in-kind assistance",
    publisher: "IFRC Disaster Law",
    url: "https://disasterlaw.ifrc.org/",
    published: "2020",
    quote:
      "In Vanuatu, 20 containers, each containing up to 22 tons of donated goods, went uncollected. A year later, they had accumulated over $2 million in storage fees.",
    retrieval: "snippet",
  },

  "ocha-unsolicited-goods": {
    title: "Unsolicited In-Kind Donations & Other Inappropriate Humanitarian Goods",
    publisher: "UN Office for the Coordination of Humanitarian Affairs (OCHA)",
    url: "https://www.unocha.org/publications",
    published: "2019",
    retrieval: "snippet",
  },

  "logcluster-unsolicited": {
    title: "Strategies for Managing Unsolicited Donations",
    publisher: "Global Logistics Cluster",
    url: "https://logcluster.org/en",
    published: "2021",
    retrieval: "snippet",
  },

  "nhc-second-disaster": {
    title: "Avoiding the 'Second Disaster' of Unwanted Donations",
    publisher: "Natural Hazards Center, University of Colorado Boulder",
    url: "https://hazards.colorado.edu/",
    published: "2018",
    retrieval: "snippet",
  },

  /* --- Cash versus in-kind ---------------------------------------------- */

  "usaid-cidi-calculator": {
    title: "Greatest Good Donation Calculator",
    publisher: "USAID Center for International Disaster Information",
    url: "https://www.cidi.org/",
    published: "2017",
    quote:
      "Cash donations allow relief organisations to buy exactly what is needed, close to where it is needed.",
    retrieval: "snippet",
  },

  "usaid-modalities": {
    title: "Food Assistance Modalities Fact Sheet",
    publisher: "USAID Bureau for Humanitarian Assistance",
    url: "https://www.usaid.gov/humanitarian-assistance",
    published: "2021",
    quote:
      "In-kind food aid shipped from the United States takes 4–6 months to reach beneficiaries.",
    retrieval: "snippet",
  },

  "state-dept-cash-is-best": {
    title: "Guidance on donations in response to international disasters",
    publisher: "U.S. Department of State",
    url: "https://www.state.gov/",
    published: "2023",
    quote:
      "Unsolicited material donations clog supply chains, waste space, and burden relief workers.",
    retrieval: "snippet",
  },

  "irc-nfi-cost-efficiency": {
    title: "Cost efficiency: non-food item distribution",
    publisher: "International Rescue Committee",
    url: "https://www.rescue.org/report/cost-efficiency-non-food-item-distribution",
    published: "2018",
    quote:
      "Comparing cash and NFI programs that served fewer than 1,000 households, NFI programs cost more per dollar of value delivered than cash programs of the same scale.",
    retrieval: "primary",
  },

  "calp-frld-2025": {
    title:
      "Submission to the FRLD Board on the use of cash transfers within the Fund's operating modalities",
    publisher: "CALP Network",
    url: "https://www.calpnetwork.org/wp-content/uploads/2025/03/Submission-to-the-FRLD-Board-on-the-use-of-cash-transfers-within-the-Funds-operating-modalities-March-2025.pdf",
    published: "2025-03",
    quote: "…meaning $80c in every $1 of L&D funding going directly to those most impacted.",
    retrieval: "snippet",
  },

  "dfid-cash-cost-effectiveness": {
    title: "Cost Effectiveness of Humanitarian Cash Programming",
    publisher: "UK Department for International Development (K4D)",
    url: "https://assets.publishing.service.gov.uk/media/5c70274ae5274a0ec72b4896/458_Cost_Effectiveness_Humanitarian_Cash_Programming.pdf",
    published: "2019-02",
    quote:
      "There is consensus in the literature that giving people cash in humanitarian contexts provides greater choice and dignity while at the same time generating cost efficiency gains.",
    retrieval: "snippet",
  },

  "alnap-cash-efficiency-2015": {
    title: "Cash-based approaches in humanitarian emergencies: a systematic review",
    publisher: "ALNAP / ODI",
    url: "https://alnap.org/documents/13545/20151113cashcefficreportfinal.pdf",
    published: "2015-11",
    quote:
      "Not only are cash transfers generally cheaper in administrative cost per dollar of value transferred, they aim to give beneficiaries greater dignity and control to prioritize their own needs.",
    retrieval: "snippet",
  },

  /* --- Labour and disposal ---------------------------------------------- */

  "nepal-minimum-wage-2025": {
    title: "Minimum wage for workers, notified under the Labour Act 2074 (2017)",
    publisher: "Government of Nepal, Ministry of Labour, Employment and Social Security",
    url: "https://www.lawimperial.com/nepal-government-increases-minimum-wage-for-workers-in-nepal/",
    published: "2025-07-17",
    quote:
      "NPR 19,550 per month — basic salary NPR 12,170 plus dearness allowance NPR 7,380 — for a full-time worker, 8 hours per day.",
    retrieval: "snippet",
  },

  "nh-des-textile-disposal": {
    title: "Discarded Textiles (Solid Waste Operator Training)",
    publisher: "New Hampshire Department of Environmental Services",
    url: "https://www.des.nh.gov/sites/g/files/ehbemt341/files/documents/2020-01/swot-discardedtextiles.pdf",
    published: "2020-01",
    quote: "350 tons x $96/ton = $33,600 in disposal costs/year.",
    retrieval: "snippet",
  },

  "wrap-textiles-2025": {
    title:
      "Charities, local authorities and the public to bear cost of UK's used textiles crisis",
    publisher: "WRAP",
    url: "https://wrap.ngo/media-centre/press-releases/charities-local-authorities-and-public-bear-cost-uks-used-textiles",
    published: "2025",
    quote:
      "The cost of collecting and sorting worn-out textiles in the UK is estimated at £88 million per year.",
    retrieval: "snippet",
  },

  "nist-textile-reuse": {
    title: "Your Clothes Can Have an Afterlife",
    publisher: "U.S. National Institute of Standards and Technology",
    url: "https://www.nist.gov/news-events/news/2022/05/your-clothes-can-have-afterlife",
    published: "2022-05",
    quote:
      "Only about 15% of used clothes and other textiles in the United States get reused or recycled. The other 85% head straight to the landfill or incinerator.",
    retrieval: "snippet",
  },

  /* --- Items that must not be donated at all ---------------------------- */

  "cdc-infant-formula-donations": {
    title: "Donating Infant Feeding Items in Emergencies",
    publisher: "U.S. Centers for Disease Control and Prevention",
    url: "https://www.cdc.gov/infant-feeding-emergencies-toolkit/php/donations.html",
    published: "2024",
    quote:
      "Do not donate infant formula during natural disasters or other emergencies. Only official relief organizations should provide and manage emergency supplies of infant formula.",
    retrieval: "snippet",
  },

  "unhcr-bms-sop": {
    title:
      "Standard Operating Procedures on Donations, Distribution and Procurement of Infant Formula and Infant Feeding Equipment",
    publisher: "UNHCR",
    url: "https://data.unhcr.org/en/documents/download/40591",
    published: "2023",
    quote:
      "A general distribution should NEVER include breast-milk substitutes or any other milk products.",
    retrieval: "snippet",
  },

  "unicef-bms-technical-note": {
    title: "Technical note on donations of breastmilk substitutes in emergencies",
    publisher: "UNICEF",
    url: "https://www.unicef.org/laos/media/4096/file/Technical%20note%20on%20donations.pdf",
    published: "2020",
    quote:
      "…and teats, should not be sought or accepted for targeted or blanket distribution.",
    retrieval: "snippet",
  },

  /* --- The response this app is set against ----------------------------- */

  "un-nepal-flash-appeal-2026": {
    title:
      "UN and partners launch US$49.6 million flash appeal for people affected by the Rasuwa flood",
    publisher: "United Nations in Nepal",
    url: "https://nepal.un.org/en",
    published: "2026-09-04",
    quote:
      "The appeal seeks US$49.6 million to reach more than 84,000 people, prioritising direct cash assistance, cold-weather shelter materials, portable solar power units, water purification systems, food aid and emergency mobile clinics, with winter fast approaching.",
    retrieval: "snippet",
  },

  "unicef-nepal-27aug2026": {
    title: "Nepal: flash floods in Rasuwa — children affected",
    publisher: "UNICEF",
    url: "https://www.unicef.org/nepal/",
    published: "2026-08-27",
    quote:
      "Around 65,000 people have been affected across Rasuwa, Nuwakot and Dhading districts, including more than 17,000 children; over 22,000 children need safe drinking water, sanitation and hygiene support.",
    retrieval: "snippet",
  },
};

/** Every citation whose text we could not retrieve in context, for the README. */
export const UNVERIFIED: readonly CitationId[] = (
  Object.keys(CITATIONS) as CitationId[]
).filter((id) => CITATIONS[id].retrieval === "snippet");

export function citation(id: CitationId): Citation {
  return CITATIONS[id];
}

/** `World Bank, Aug 2009` — the short form printed beside a ledger line. */
export function citationLabel(id: CitationId): string {
  const { publisher, published } = CITATIONS[id];
  const [year, month] = published.split("-");
  const short = publisher.split("(")[0].split("—")[0].trim();
  if (!month) return `${short}, ${year}`;
  const name = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", {
    month: "short",
  });
  return `${short}, ${name} ${year}`;
}
