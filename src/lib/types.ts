// ─────────────────────────────────────────────────────────────────────────────
// Shared domain types for the Holafly Negotiation Helper.
// ─────────────────────────────────────────────────────────────────────────────

export type Platform = "instagram" | "tiktok" | "youtube" | "unknown";

export type RelationshipStage = "first" | "proven" | "ambassador";

export type NegotiationStatus = "active" | "won" | "lost" | "paused";

export type MessageRole = "creator" | "ae" | "assistant" | "note";

/**
 * Metrics extracted from a single HypeAuditor report (one platform).
 * Almost everything is optional — reports vary and the model only fills what it
 * can actually read.
 */
export interface ReportMetrics {
  platform: Platform;
  creatorName?: string | null;
  creatorHandle?: string | null;

  followers?: number | null; // followers / subscribers
  avgLikes?: number | null;
  avgComments?: number | null;
  avgViews?: number | null;
  avgShares?: number | null;
  avgReach?: number | null;
  engagementRatePct?: number | null; // %

  aqs?: number | null; // Audience/Account Quality Score, 1-100
  qualityAudiencePct?: number | null; // %
  audienceAuthenticityPct?: number | null; // %
  audienceReachabilityLabel?: string | null; // e.g. "Very Good"

  estimatedReachPostMin?: number | null;
  estimatedReachPostMax?: number | null;
  estimatedReachStoryMin?: number | null;
  estimatedReachStoryMax?: number | null;
  estimatedImpressions?: number | null;

  // Audience type breakdown (percentages 0-100)
  audienceRealPct?: number | null;
  audienceInfluencersPct?: number | null;
  audienceMassFollowersPct?: number | null;
  audienceSuspiciousPct?: number | null;

  audienceByCountry?: { country: string; pct: number }[] | null;
  audienceLanguages?: { language: string; pct: number }[] | null;
  audienceInterests?: { interest: string; pct: number }[] | null;
  brandAffinity?: string[] | null;

  // Age / gender
  audienceMalePct?: number | null;
  audienceFemalePct?: number | null;
  audienceAgeBrackets?: { bracket: string; pct: number }[] | null; // combined m+f per bracket

  yearlyGrowthPct?: number | null;
  growthFlags?: string[] | null; // e.g. "Abnormal growth more than 12 months ago"

  postPriceEstimateMin?: number | null;
  postPriceEstimateMax?: number | null;
  priceCurrency?: string | null;

  extractionNotes?: string | null; // anything the model wants to caveat
}

export type RuleCheckStatus = "pass" | "warn" | "fail";

export interface RuleCheck {
  id: string;
  label: string;
  status: RuleCheckStatus;
  detail: string;
}

export type EngagementVerdict =
  | "poor"
  | "ok"
  | "good"
  | "excellent"
  | "suspicious"
  | "unknown";

/** Deterministic scoring computed from metrics + rules. */
export interface Scores {
  platform: Platform;
  tier: "nano" | "micro" | "mid" | "macro" | "mega" | "unknown";
  followers?: number | null;

  engagementRatePct?: number | null;
  engagementVerdict: EngagementVerdict;

  targetGeoPct: number | null; // share of audience in target markets (0-100)
  authenticityFactor: number | null; // 0-1 multiplier (quality audience)
  travelAffinityPct: number | null; // share of audience with travel interest (0-100)
  targetAgePct: number | null; // share of audience in target age range (0-100)

  estimatedReachMid: number | null; // mid-point of estimated post reach
  effectiveReach: number | null; // estimatedReach * authenticity * geo * affinity

  audienceFitScore: number | null; // 0-100 composite
  audienceFitLabel: string;

  fairPriceLowEur: number | null;
  fairPriceMidEur: number | null;
  fairPriceHighEur: number | null;

  ruleChecks: RuleCheck[];
  redFlags: string[];
  greenFlags: string[];
}

/** Structured recommendation produced by the Claude assistant. */
export interface RecommendedTerms {
  structure: string;
  flatFeeEur?: number | null;
  deliverables: string;
  affiliateCommissionPct?: number | null;
  usageRights?: string | null;
  exclusivity?: string | null;
  paymentTerms?: string | null;
  otherIncentives?: string | null;
}

export interface AssistantRecommendation {
  summary: string;
  recommendedTerms: RecommendedTerms;
  draftReply: string;
  rationale: string[];
  ruleFlags: string[];
  concessionPlan: string[];
  walkAwayPoint?: string | null;
  estimatedDealCpmEur?: number | null;
}

// ── Database row shapes (as returned to the client; JSON fields parsed) ──────

export interface Negotiation {
  id: string;
  creatorName: string;
  creatorHandle: string | null;
  platforms: Platform[];
  campaign: string | null;
  budgetEur: number | null;
  currency: string;
  relationshipStage: RelationshipStage;
  status: NegotiationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  negotiationId: string;
  platform: Platform;
  filename: string | null;
  metrics: ReportMetrics | null;
  scores: Scores | null;
  createdAt: string;
}

export interface Message {
  id: string;
  negotiationId: string;
  role: MessageRole;
  content: string;
  recommendation: AssistantRecommendation | null;
  createdAt: string;
}

/** A past collaboration with this creator and its measured return. */
export interface PastDeal {
  id: string;
  negotiationId: string;
  label: string | null; // e.g. "Mar 2026 Reel"
  platform: Platform | null;
  spendEur: number | null; // what we paid (flat fee + product cost, etc.)
  revenueEur: number | null; // affiliate revenue it generated
  conversions: number | null; // # of tracked sales (optional)
  notes: string | null;
  createdAt: string;
}

export interface NegotiationDetail extends Negotiation {
  reports: Report[];
  messages: Message[];
  pastDeals: PastDeal[];
}
