// ─────────────────────────────────────────────────────────────────────────────
// The editable "rules engine" configuration.
//
// These are the guardrails the account-executive team negotiates within. They
// are seeded from market research (2025-2026) but every value is editable in the
// Settings page and stored in the database, so the team can tune the tool's
// behaviour without touching code.
// ─────────────────────────────────────────────────────────────────────────────

export interface CpmBand {
  /** What we'd like to pay (or beat) per 1,000 views/impressions. */
  target: number;
  /** Hard ceiling — above this the tool flags the deal. */
  cap: number;
}

export interface RulesConfig {
  currency: string; // display currency, e.g. "EUR"

  brandContext: string; // injected into the assistant's system prompt

  // Format-specific CPM guardrails (in `currency`).
  cpm: {
    tiktok: CpmBand;
    igReels: CpmBand;
    igStoriesFeed: CpmBand;
    ytIntegration: CpmBand;
    ytDedicated: CpmBand;
  };

  // Content volume
  minContentItemsFirstCollab: number;
  bundleDiscountPctMin: number; // % off 3x single rate
  bundleDiscountPctMax: number;

  // Affiliate / commission
  affiliate: {
    maxCommissionPct: number;
    defaultStartPct: number;
    cookieDays: number;
  };

  // ROAS (return on ad spend = revenue ÷ spend) thresholds for past deals.
  roas: {
    target: number; // we aim for this (e.g. 3x)
    bonus: number; // special-case: a performance bonus may trigger at this ROAS (e.g. 4x)
    minimum: number; // below this = weak; restructure toward performance / be cautious
  };

  // Audience quality gates (used for pass/warn/fail rule checks)
  audienceGates: {
    minAqs: number; // below = fail
    warnAqs: number; // below = warn
    maxSuspiciousPct: number; // suspicious + mass followers above this = fail
    minTargetGeoPct: number; // below = warn (audience not in our markets)
    minEngagementRatePct: number; // platform-agnostic floor; per-platform handled in scoring
  };

  // Audience-fit weighting (must roughly sum to 100; renormalised if data missing)
  fitWeights: {
    geography: number;
    interests: number;
    age: number;
    authenticity: number;
    language: number;
  };

  // Holafly's customers are international travellers. Audience concentrated in
  // these markets (high outbound-travel, high-spend) is most valuable.
  targetMarkets: string[]; // country names as they appear in HypeAuditor
  targetLanguages: string[]; // e.g. ["English"]
  targetAgeMin: number;
  targetAgeMax: number;
  travelInterestKeywords: string[]; // interests that count as "travel affinity"

  // Deal structure defaults / negotiation posture
  paymentTerms: {
    firstDeal: string;
    proven: string;
  };
  usageRights: {
    defaultWindowDays: number;
    avoidPerpetual: boolean;
  };
  exclusivity: {
    scopeNote: string;
    competitors: string[];
  };
  dealTemplates: {
    first: string;
    proven: string;
    ambassador: string;
  };

  // Follower-tier boundaries (max follower count for each tier)
  tiers: {
    nanoMax: number;
    microMax: number;
    midMax: number;
    macroMax: number;
  };
}

export const DEFAULT_RULES: RulesConfig = {
  currency: "EUR",

  brandContext:
    "Holafly is an eSIM provider for international travellers (data plans for 200+ destinations). " +
    "Our customers are people about to travel abroad who want mobile data without roaming fees. " +
    "We grow largely through affiliate creators who share a personalised discount code/link with their audience. " +
    "The best-fit creators make travel, adventure, digital-nomad, or lifestyle content with an audience of real, " +
    "engaged travellers in high-outbound-travel markets. YouTube integrations and authentic 'I used this on my trip' " +
    "content convert especially well because eSIM needs a quick explanation + setup demo.",

  cpm: {
    tiktok: { target: 12, cap: 20 },
    igReels: { target: 20, cap: 30 },
    igStoriesFeed: { target: 25, cap: 40 },
    ytIntegration: { target: 20, cap: 35 },
    ytDedicated: { target: 50, cap: 70 },
  },

  minContentItemsFirstCollab: 3,
  bundleDiscountPctMin: 15,
  bundleDiscountPctMax: 20,

  affiliate: {
    maxCommissionPct: 20,
    defaultStartPct: 10,
    cookieDays: 60,
  },

  roas: {
    target: 3,
    bonus: 4,
    minimum: 1.5,
  },

  audienceGates: {
    minAqs: 40,
    warnAqs: 60,
    maxSuspiciousPct: 35,
    minTargetGeoPct: 30,
    minEngagementRatePct: 1,
  },

  fitWeights: {
    geography: 30,
    interests: 25,
    age: 15,
    authenticity: 20,
    language: 10,
  },

  targetMarkets: [
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "Germany",
    "France",
    "Spain",
    "Italy",
    "Netherlands",
    "Switzerland",
    "Ireland",
    "Sweden",
    "Norway",
    "Denmark",
    "Belgium",
    "Austria",
    "Mexico",
    "Brazil",
    "United Arab Emirates",
    "Singapore",
    "Japan",
    "South Korea",
    "New Zealand",
    "Portugal",
  ],
  targetLanguages: ["English"],
  targetAgeMin: 25,
  targetAgeMax: 45,
  travelInterestKeywords: [
    "travel",
    "traveling",
    "travelling",
    "tourism",
    "adventure",
    "hiking",
    "trekking",
    "camping",
    "outdoor",
    "backpacking",
    "nomad",
    "beach",
    "nature",
    "road trip",
    "vacation",
    "holiday",
    "cruise",
    "flights",
    "aviation",
  ],

  paymentTerms: {
    firstDeal: "50% on signing, 50% net-30 after content is live",
    proven: "Net-30 after delivery",
  },
  usageRights: {
    defaultWindowDays: 90,
    avoidPerpetual: true,
  },
  exclusivity: {
    scopeNote:
      "Scope exclusivity narrowly to named eSIM competitors and a defined campaign window — never a blanket 'travel/telecom' lockout.",
    competitors: ["Airalo", "Saily", "Nomad", "Yesim", "Airhub", "aloSIM", "Ubigi"],
  },
  dealTemplates: {
    first:
      "First collaboration: lead with low cash risk — free eSIM + personalised affiliate code, plus a small content bundle (≈3 items). Add a modest reduced flat fee only for mid/larger creators. Short (≤90 day) usage window, named-competitor exclusivity only if needed, milestone payment.",
    proven:
      "Proven creator: introduce a modest retainer or guaranteed flat + tiered affiliate commission + a performance bonus. Net-30. Broader but still time-boxed usage rights.",
    ambassador:
      "Ambassador: fixed monthly retainer + standing affiliate code + early access to launches + first-look exclusivity on eSIM.",
  },

  tiers: {
    nanoMax: 10000,
    microMax: 50000,
    midMax: 500000,
    macroMax: 1000000,
  },
};
