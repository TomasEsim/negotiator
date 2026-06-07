// ─────────────────────────────────────────────────────────────────────────────
// Deterministic scoring. This is the transparent, auditable layer: given the
// metrics read from a HypeAuditor report and the editable rules, it computes
// tiers, effective reach, audience-fit, fair-price ranges and rule checks.
//
// No AI here — every number can be traced. The Claude assistant reasons *on top*
// of these numbers; it does not replace them.
// ─────────────────────────────────────────────────────────────────────────────

import type { RulesConfig, CpmBand } from "./rules";
import type {
  EngagementVerdict,
  Platform,
  ReportMetrics,
  RuleCheck,
  Scores,
} from "./types";

function round(n: number, to = 1): number {
  return Math.round(n / to) * to;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ── Country matching ─────────────────────────────────────────────────────────

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "united states",
  us: "united states",
  "united states of america": "united states",
  uk: "united kingdom",
  "great britain": "united kingdom",
  uae: "united arab emirates",
  "south korea": "south korea",
  korea: "south korea",
};

function normalizeCountry(name: string): string {
  const n = name.trim().toLowerCase();
  return COUNTRY_ALIASES[n] ?? n;
}

function isTargetCountry(country: string, targets: string[]): boolean {
  const c = normalizeCountry(country);
  return targets.some((t) => {
    const tn = normalizeCountry(t);
    return c === tn || c.includes(tn) || tn.includes(c);
  });
}

// ── Tier ─────────────────────────────────────────────────────────────────────

function detectTier(followers: number | null | undefined, rules: RulesConfig): Scores["tier"] {
  if (followers == null || followers <= 0) return "unknown";
  const { nanoMax, microMax, midMax, macroMax } = rules.tiers;
  if (followers < nanoMax) return "nano";
  if (followers < microMax) return "micro";
  if (followers < midMax) return "mid";
  if (followers < macroMax) return "macro";
  return "mega";
}

// ── Engagement verdict (per platform) ────────────────────────────────────────

function engagementVerdict(
  platform: Platform,
  erPct: number | null | undefined
): EngagementVerdict {
  if (erPct == null) return "unknown";
  if (erPct > 50) return "suspicious"; // not a credible ER — likely a parse error or bought engagement
  // thresholds: [poor<, ok<, good<, excellent>=]
  const bands: Record<Exclude<Platform, "unknown">, [number, number, number]> = {
    instagram: [1, 3, 6],
    tiktok: [3, 8, 12],
    youtube: [2, 4, 6],
  };
  const b = platform === "unknown" ? bands.instagram : bands[platform];
  if (erPct < b[0]) return "poor";
  if (erPct < b[1]) return "ok";
  if (erPct < b[2]) return "good";
  return "excellent";
}

// ── Audience helpers ─────────────────────────────────────────────────────────

function sumTargetGeo(metrics: ReportMetrics, rules: RulesConfig): number | null {
  if (!metrics.audienceByCountry || metrics.audienceByCountry.length === 0) return null;
  let sum = 0;
  for (const { country, pct } of metrics.audienceByCountry) {
    if (isTargetCountry(country, rules.targetMarkets)) sum += pct;
  }
  return clamp(round(sum, 0.1), 0, 100);
}

function travelAffinity(metrics: ReportMetrics, rules: RulesConfig): number | null {
  if (!metrics.audienceInterests || metrics.audienceInterests.length === 0) return null;
  const kws = rules.travelInterestKeywords.map((k) => k.toLowerCase());
  let max = 0;
  for (const { interest, pct } of metrics.audienceInterests) {
    const i = interest.toLowerCase();
    if (kws.some((k) => i.includes(k))) max = Math.max(max, pct);
  }
  return max > 0 ? round(max, 0.1) : 0;
}

function parseAgeBracket(b: string): [number, number] | null {
  const s = b.trim();
  if (/^\d+\s*\+$/.test(s)) return [parseInt(s, 10), 200];
  const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  return null;
}

function targetAge(metrics: ReportMetrics, rules: RulesConfig): number | null {
  if (!metrics.audienceAgeBrackets || metrics.audienceAgeBrackets.length === 0) return null;
  let sum = 0;
  for (const { bracket, pct } of metrics.audienceAgeBrackets) {
    const range = parseAgeBracket(bracket);
    if (!range) continue;
    const [lo, hi] = range;
    if (lo <= rules.targetAgeMax && hi >= rules.targetAgeMin) sum += pct;
  }
  return clamp(round(sum, 0.1), 0, 100);
}

function targetLanguage(metrics: ReportMetrics, rules: RulesConfig): number | null {
  if (!metrics.audienceLanguages || metrics.audienceLanguages.length === 0) return null;
  const targets = rules.targetLanguages.map((l) => l.toLowerCase());
  let sum = 0;
  for (const { language, pct } of metrics.audienceLanguages) {
    if (targets.some((t) => language.toLowerCase().includes(t))) sum += pct;
  }
  return clamp(round(sum, 0.1), 0, 100);
}

function authenticityFactor(metrics: ReportMetrics): number | null {
  if (metrics.qualityAudiencePct != null) return clamp(metrics.qualityAudiencePct / 100, 0, 1);
  if (metrics.audienceRealPct != null) {
    const infl = metrics.audienceInfluencersPct ?? 0;
    return clamp((metrics.audienceRealPct + infl) / 100, 0, 1);
  }
  if (metrics.audienceAuthenticityPct != null)
    return clamp(metrics.audienceAuthenticityPct / 100, 0, 1);
  return null;
}

function estimatedReachMid(metrics: ReportMetrics): number | null {
  if (metrics.estimatedReachPostMin != null && metrics.estimatedReachPostMax != null)
    return round((metrics.estimatedReachPostMin + metrics.estimatedReachPostMax) / 2, 1);
  if (metrics.avgReach != null) return metrics.avgReach;
  if (metrics.avgViews != null) return metrics.avgViews;
  return null;
}

// ── CPM selection by platform ────────────────────────────────────────────────

function representativeCpm(platform: Platform, rules: RulesConfig): CpmBand {
  switch (platform) {
    case "tiktok":
      return rules.cpm.tiktok;
    case "youtube":
      return rules.cpm.ytIntegration;
    case "instagram":
    default:
      return rules.cpm.igReels;
  }
}

// ── Audience-fit composite ───────────────────────────────────────────────────

function audienceFit(
  parts: {
    geo: number | null;
    interest: number | null;
    age: number | null;
    authenticity: number | null; // 0-1
    language: number | null;
  },
  rules: RulesConfig
): number | null {
  const components: { score: number; weight: number }[] = [];
  const w = rules.fitWeights;
  if (parts.geo != null) components.push({ score: clamp(parts.geo, 0, 100), weight: w.geography });
  if (parts.interest != null)
    components.push({ score: clamp(parts.interest * 2, 0, 100), weight: w.interests });
  if (parts.age != null) components.push({ score: clamp(parts.age, 0, 100), weight: w.age });
  if (parts.authenticity != null)
    components.push({ score: clamp(parts.authenticity * 100, 0, 100), weight: w.authenticity });
  if (parts.language != null)
    components.push({ score: clamp(parts.language, 0, 100), weight: w.language });

  if (components.length === 0) return null;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return null;
  const score = components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight;
  return Math.round(score);
}

function fitLabel(score: number | null): string {
  if (score == null) return "Unknown (no audience data)";
  if (score >= 80) return "Excellent fit";
  if (score >= 65) return "Strong fit";
  if (score >= 50) return "Moderate fit";
  if (score >= 35) return "Weak fit";
  return "Poor fit";
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function scoreReport(metrics: ReportMetrics, rules: RulesConfig): Scores {
  const platform = metrics.platform ?? "unknown";
  const tier = detectTier(metrics.followers, rules);
  const erPct = metrics.engagementRatePct ?? null;
  const verdict = engagementVerdict(platform, erPct);

  const geo = sumTargetGeo(metrics, rules);
  const auth = authenticityFactor(metrics);
  const affinity = travelAffinity(metrics, rules);
  const agePct = targetAge(metrics, rules);
  const langPct = targetLanguage(metrics, rules);

  const reachMid = estimatedReachMid(metrics);
  const effectiveReach =
    reachMid != null
      ? round(reachMid * (auth ?? 1) * ((geo ?? 100) / 100), 1)
      : null;

  const fit = audienceFit(
    { geo, interest: affinity, age: agePct, authenticity: auth, language: langPct },
    rules
  );

  // Fair price per single content item, from effective reach × CPM band.
  const band = representativeCpm(platform, rules);
  let fairLow: number | null = null;
  let fairMid: number | null = null;
  let fairHigh: number | null = null;
  if (effectiveReach != null && effectiveReach > 0) {
    const k = effectiveReach / 1000;
    fairLow = round(k * band.target * 0.6, 10);
    fairMid = round(k * band.target, 10);
    fairHigh = round(k * band.cap, 10);
  }

  const ruleChecks = buildRuleChecks(metrics, rules, { geo, verdict, platform });
  const { redFlags, greenFlags } = buildFlags(metrics, rules, {
    geo,
    affinity,
    auth,
    verdict,
    fit,
  });

  return {
    platform,
    tier,
    followers: metrics.followers ?? null,
    engagementRatePct: erPct,
    engagementVerdict: verdict,
    targetGeoPct: geo,
    authenticityFactor: auth,
    travelAffinityPct: affinity,
    targetAgePct: agePct,
    estimatedReachMid: reachMid,
    effectiveReach,
    audienceFitScore: fit,
    audienceFitLabel: fitLabel(fit),
    fairPriceLowEur: fairLow,
    fairPriceMidEur: fairMid,
    fairPriceHighEur: fairHigh,
    ruleChecks,
    redFlags,
    greenFlags,
  };
}

function buildRuleChecks(
  metrics: ReportMetrics,
  rules: RulesConfig,
  ctx: { geo: number | null; verdict: EngagementVerdict; platform: Platform }
): RuleCheck[] {
  const checks: RuleCheck[] = [];
  const g = rules.audienceGates;

  // AQS
  if (metrics.aqs != null) {
    const status: RuleCheck["status"] =
      metrics.aqs >= g.warnAqs ? "pass" : metrics.aqs >= g.minAqs ? "warn" : "fail";
    checks.push({
      id: "aqs",
      label: "Audience/Account Quality Score",
      status,
      detail: `AQS ${metrics.aqs}/100 (pass ≥ ${g.warnAqs}, fail < ${g.minAqs}).`,
    });
  }

  // Suspicious + mass followers
  const suspicious = (metrics.audienceSuspiciousPct ?? 0) + (metrics.audienceMassFollowersPct ?? 0);
  if (metrics.audienceSuspiciousPct != null || metrics.audienceMassFollowersPct != null) {
    const status: RuleCheck["status"] =
      suspicious > g.maxSuspiciousPct ? "fail" : suspicious > g.maxSuspiciousPct * 0.6 ? "warn" : "pass";
    checks.push({
      id: "suspicious",
      label: "Suspicious + mass followers",
      status,
      detail: `${round(suspicious, 0.1)}% low-quality audience (cap ${g.maxSuspiciousPct}%).`,
    });
  }

  // Target geography
  if (ctx.geo != null) {
    const status: RuleCheck["status"] = ctx.geo >= g.minTargetGeoPct ? "pass" : "warn";
    checks.push({
      id: "geo",
      label: "Audience in target markets",
      status,
      detail: `${ctx.geo}% of audience in Holafly target markets (min ${g.minTargetGeoPct}%).`,
    });
  }

  // Engagement
  if (metrics.engagementRatePct != null) {
    const status: RuleCheck["status"] =
      ctx.verdict === "suspicious"
        ? "fail"
        : ctx.verdict === "poor"
        ? "warn"
        : "pass";
    checks.push({
      id: "engagement",
      label: "Engagement rate",
      status,
      detail: `${metrics.engagementRatePct}% — ${ctx.verdict} for ${ctx.platform}.`,
    });
  }

  return checks;
}

function buildFlags(
  metrics: ReportMetrics,
  rules: RulesConfig,
  ctx: {
    geo: number | null;
    affinity: number | null;
    auth: number | null;
    verdict: EngagementVerdict;
    fit: number | null;
  }
): { redFlags: string[]; greenFlags: string[] } {
  const redFlags: string[] = [];
  const greenFlags: string[] = [];

  // Growth anomalies straight from the report
  for (const f of metrics.growthFlags ?? []) {
    if (/abnormal|suspicious|inauthentic|drop|spike/i.test(f)) redFlags.push(f);
  }

  const suspicious = (metrics.audienceSuspiciousPct ?? 0) + (metrics.audienceMassFollowersPct ?? 0);
  if (suspicious > rules.audienceGates.maxSuspiciousPct)
    redFlags.push(`High low-quality audience (${round(suspicious, 0.1)}%).`);

  if (ctx.verdict === "suspicious")
    redFlags.push("Engagement rate is implausibly high — verify it isn't inflated.");
  if (ctx.verdict === "poor")
    redFlags.push("Engagement rate is below the healthy range for this platform.");

  if (ctx.geo != null && ctx.geo < rules.audienceGates.minTargetGeoPct)
    redFlags.push(`Only ${ctx.geo}% of audience is in Holafly target markets.`);

  // Green flags
  if (ctx.verdict === "excellent" || ctx.verdict === "good")
    greenFlags.push(`Healthy engagement (${metrics.engagementRatePct}%).`);
  if (metrics.aqs != null && metrics.aqs >= rules.audienceGates.warnAqs)
    greenFlags.push(`High audience quality (AQS ${metrics.aqs}).`);
  if (ctx.affinity != null && ctx.affinity >= 30)
    greenFlags.push(`Strong travel affinity (${ctx.affinity}% of audience).`);
  if (ctx.geo != null && ctx.geo >= 50)
    greenFlags.push(`Audience well-concentrated in target markets (${ctx.geo}%).`);
  if (ctx.auth != null && ctx.auth >= 0.7)
    greenFlags.push(`Authentic audience (${round(ctx.auth * 100, 1)}% quality).`);

  return { redFlags, greenFlags };
}

// ── Compact text summary for the assistant prompt ────────────────────────────

export function summarizeScoresForPrompt(
  platform: Platform,
  metrics: ReportMetrics,
  scores: Scores,
  rules: RulesConfig
): string {
  const lines: string[] = [];
  const fmt = (n: number | null | undefined, suffix = "") =>
    n == null ? "n/a" : `${n}${suffix}`;
  lines.push(`Platform: ${platform}`);
  lines.push(`Handle: ${metrics.creatorHandle ?? "n/a"} | Name: ${metrics.creatorName ?? "n/a"}`);
  lines.push(`Followers: ${fmt(metrics.followers)} (tier: ${scores.tier})`);
  lines.push(
    `Engagement: ${fmt(metrics.engagementRatePct, "%")} (${scores.engagementVerdict}); ` +
      `avg likes ${fmt(metrics.avgLikes)}, comments ${fmt(metrics.avgComments)}, views ${fmt(metrics.avgViews)}`
  );
  lines.push(`AQS: ${fmt(metrics.aqs)}/100`);
  lines.push(
    `Audience quality: ${fmt(metrics.qualityAudiencePct, "%")} quality, ` +
      `${fmt(metrics.audienceSuspiciousPct, "%")} suspicious, ${fmt(metrics.audienceMassFollowersPct, "%")} mass-followers`
  );
  lines.push(`Audience in target markets: ${fmt(scores.targetGeoPct, "%")}`);
  lines.push(`Travel affinity (top travel interest): ${fmt(scores.travelAffinityPct, "%")}`);
  lines.push(`Audience age in ${rules.targetAgeMin}-${rules.targetAgeMax}: ${fmt(scores.targetAgePct, "%")}`);
  lines.push(
    `Gender: ${fmt(metrics.audienceFemalePct, "% F")} / ${fmt(metrics.audienceMalePct, "% M")}`
  );
  if (metrics.audienceByCountry?.length) {
    lines.push(
      `Top countries: ` +
        metrics.audienceByCountry
          .slice(0, 6)
          .map((c) => `${c.country} ${c.pct}%`)
          .join(", ")
    );
  }
  lines.push(
    `Estimated reach/post: ${fmt(metrics.estimatedReachPostMin)}-${fmt(metrics.estimatedReachPostMax)} ` +
      `(mid ${fmt(scores.estimatedReachMid)}); effective (real, in-market) reach ≈ ${fmt(scores.effectiveReach)}`
  );
  lines.push(`Audience-fit score: ${fmt(scores.audienceFitScore)}/100 (${scores.audienceFitLabel})`);
  lines.push(
    `Fair price per content item (from effective reach × CPM): ` +
      `€${fmt(scores.fairPriceLowEur)}–€${fmt(scores.fairPriceHighEur)} (mid €${fmt(scores.fairPriceMidEur)})`
  );
  if (scores.redFlags.length) lines.push(`Red flags: ${scores.redFlags.join("; ")}`);
  if (scores.greenFlags.length) lines.push(`Green flags: ${scores.greenFlags.join("; ")}`);
  return lines.join("\n");
}
