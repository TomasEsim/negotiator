import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RulesConfig } from "./rules";
import { summarizeScoresForPrompt } from "./scoring";
import { computeRoas } from "./format";
import type {
  AssistantRecommendation,
  Message,
  Negotiation,
  PastDeal,
  Platform,
  Report,
  ReportMetrics,
} from "./types";

const ASSISTANT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const EXTRACTION_MODEL =
  process.env.ANTHROPIC_EXTRACTION_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your Anthropic API key."
    );
    this.name = "MissingApiKeyError";
  }
}

// Env-file loaders (Next's @next/env, dotenv) do NOT override a variable that is
// already present in process.env. Some shells export an empty ANTHROPIC_API_KEY,
// which silently shadows the real value in .env.local. To be robust, fall back to
// reading the env files directly when the process value is empty.
let cachedFileEnv: Record<string, string> | null = null;
function fileEnv(): Record<string, string> {
  if (cachedFileEnv) return cachedFileEnv;
  const out: Record<string, string> = {};
  // Only needed in local dev (some shells export an empty ANTHROPIC_API_KEY that
  // shadows .env.local). In production (Vercel) env vars come from the platform,
  // so we skip the filesystem read entirely.
  if (process.env.NODE_ENV !== "production") {
    for (const f of [".env.local", ".env"]) {
      try {
        const txt = readFileSync(join(/* turbopackIgnore: true */ process.cwd(), f), "utf8");
        for (const line of txt.split(/\r?\n/)) {
          const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
          if (!m) continue;
          let val = m[2];
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!(m[1] in out)) out[m[1]] = val; // .env.local (read first) wins
        }
      } catch {
        /* file may not exist — that's fine */
      }
    }
  }
  cachedFileEnv = out;
  return out;
}

function resolveApiKey(): string | undefined {
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return fileEnv().ANTHROPIC_API_KEY?.trim() || undefined;
}

function client(): Anthropic {
  const apiKey = resolveApiKey();
  if (!apiKey) throw new MissingApiKeyError();
  return new Anthropic({ apiKey });
}

function firstToolInput<T>(msg: Anthropic.Messages.Message): T {
  for (const block of msg.content) {
    if (block.type === "tool_use") return block.input as T;
  }
  throw new Error("Model did not return structured output (no tool_use block).");
}

// ── 1. PDF extraction ────────────────────────────────────────────────────────

const EXTRACTION_TOOL: Anthropic.Messages.Tool = {
  name: "save_report_metrics",
  description:
    "Save the metrics extracted from a HypeAuditor influencer report. Fill every field you can read; use null when a value is not present. Convert abbreviated numbers to integers (e.g. '52.7K' -> 52700, '1.2M' -> 1200000). Express percentages as plain numbers (e.g. 5.59 for '5.59%').",
  input_schema: {
    type: "object",
    properties: {
      platform: { type: "string", enum: ["instagram", "tiktok", "youtube", "unknown"] },
      creatorName: { type: ["string", "null"] },
      creatorHandle: { type: ["string", "null"] },
      followers: { type: ["number", "null"], description: "followers / subscribers" },
      avgLikes: { type: ["number", "null"] },
      avgComments: { type: ["number", "null"] },
      avgViews: { type: ["number", "null"] },
      avgShares: { type: ["number", "null"] },
      avgReach: { type: ["number", "null"] },
      engagementRatePct: { type: ["number", "null"] },
      aqs: { type: ["number", "null"], description: "Audience/Account Quality Score, 1-100" },
      qualityAudiencePct: { type: ["number", "null"] },
      audienceAuthenticityPct: { type: ["number", "null"] },
      audienceReachabilityLabel: { type: ["string", "null"] },
      estimatedReachPostMin: { type: ["number", "null"] },
      estimatedReachPostMax: { type: ["number", "null"] },
      estimatedReachStoryMin: { type: ["number", "null"] },
      estimatedReachStoryMax: { type: ["number", "null"] },
      estimatedImpressions: { type: ["number", "null"] },
      audienceRealPct: { type: ["number", "null"] },
      audienceInfluencersPct: { type: ["number", "null"] },
      audienceMassFollowersPct: { type: ["number", "null"] },
      audienceSuspiciousPct: { type: ["number", "null"] },
      audienceByCountry: {
        type: ["array", "null"],
        items: {
          type: "object",
          properties: { country: { type: "string" }, pct: { type: "number" } },
          required: ["country", "pct"],
        },
      },
      audienceLanguages: {
        type: ["array", "null"],
        items: {
          type: "object",
          properties: { language: { type: "string" }, pct: { type: "number" } },
          required: ["language", "pct"],
        },
      },
      audienceInterests: {
        type: ["array", "null"],
        items: {
          type: "object",
          properties: { interest: { type: "string" }, pct: { type: "number" } },
          required: ["interest", "pct"],
        },
      },
      brandAffinity: { type: ["array", "null"], items: { type: "string" } },
      audienceMalePct: { type: ["number", "null"] },
      audienceFemalePct: { type: ["number", "null"] },
      audienceAgeBrackets: {
        type: ["array", "null"],
        description: "Combined male+female percentage per age bracket, e.g. {bracket:'25-34', pct:34}",
        items: {
          type: "object",
          properties: { bracket: { type: "string" }, pct: { type: "number" } },
          required: ["bracket", "pct"],
        },
      },
      yearlyGrowthPct: { type: ["number", "null"] },
      growthFlags: {
        type: ["array", "null"],
        description: "Any growth/authenticity warnings shown, e.g. 'Abnormal growth more than 12 months ago'",
        items: { type: "string" },
      },
      postPriceEstimateMin: { type: ["number", "null"] },
      postPriceEstimateMax: { type: ["number", "null"] },
      priceCurrency: { type: ["string", "null"] },
      extractionNotes: {
        type: ["string", "null"],
        description: "Anything ambiguous or worth caveating about this extraction.",
      },
    },
    required: ["platform"],
  },
};

export type PdfSource =
  | { kind: "base64"; data: string }
  | { kind: "url"; url: string };

export async function extractReportFromSource(
  src: PdfSource,
  platformHint?: Platform
): Promise<ReportMetrics> {
  const hint =
    platformHint && platformHint !== "unknown"
      ? `The user indicates this report is for ${platformHint}. Confirm from the report content.`
      : "Determine the platform (Instagram, TikTok, or YouTube) from the report content.";

  const msg = await client().messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: [
      {
        type: "text",
        text:
          "You are a meticulous data-extraction engine for HypeAuditor influencer reports. " +
          "These PDFs are image-based screen captures; read every page carefully. Extract numbers exactly as shown, " +
          "converting abbreviations ('K','M') to integers and percentages to plain numbers. Never invent data — " +
          "use null for anything not clearly present. Then call the save_report_metrics tool.",
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source:
              src.kind === "url"
                ? { type: "url", url: src.url }
                : { type: "base64", media_type: "application/pdf", data: src.data },
          },
          { type: "text", text: `${hint}\n\nExtract all available metrics and call the tool.` },
        ],
      },
    ],
  });

  const raw = firstToolInput<ReportMetrics>(msg);
  if (platformHint && platformHint !== "unknown") raw.platform = platformHint;
  if (!raw.platform) raw.platform = "unknown";
  return raw;
}

/** Convenience wrapper for base64 (local multipart) uploads. */
export function extractReportFromPdf(pdfBase64: string, platformHint?: Platform) {
  return extractReportFromSource({ kind: "base64", data: pdfBase64 }, platformHint);
}

// ── 2. Negotiation assistant ─────────────────────────────────────────────────

const RECOMMENDATION_TOOL: Anthropic.Messages.Tool = {
  name: "provide_recommendation",
  description:
    "Provide a negotiation recommendation: a recommended deal structure, a ready-to-send draft reply to the creator, and the reasoning behind it.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "1-2 sentence read of the situation and what we should do.",
      },
      recommendedTerms: {
        type: "object",
        properties: {
          structure: {
            type: "string",
            description: "e.g. 'Hybrid: free eSIM + affiliate code + reduced flat fee'",
          },
          flatFeeEur: { type: ["number", "null"] },
          deliverables: { type: "string", description: "e.g. '1 Reel + 2 Stories with affiliate code'" },
          affiliateCommissionPct: { type: ["number", "null"] },
          usageRights: { type: ["string", "null"] },
          exclusivity: { type: ["string", "null"] },
          paymentTerms: { type: ["string", "null"] },
          otherIncentives: { type: ["string", "null"] },
        },
        required: ["structure", "deliverables"],
      },
      draftReply: {
        type: "string",
        description:
          "The actual message to send to the creator, in clean Markdown (use **bold**, short section headers, and a | Deliverable | Rate | table when proposing a package). Professional, warm, concise.",
      },
      rationale: {
        type: "array",
        items: { type: "string" },
        description: "Bullet points explaining why these terms — cite the data and the rules.",
      },
      ruleFlags: {
        type: "array",
        items: { type: "string" },
        description: "Any rule violations or cautions (e.g. CPM over cap, audience red flags).",
      },
      concessionPlan: {
        type: "array",
        items: { type: "string" },
        description: "What to trade / how to respond if the creator pushes back.",
      },
      walkAwayPoint: {
        type: ["string", "null"],
        description: "The point past which we should decline.",
      },
      estimatedDealCpmEur: {
        type: ["number", "null"],
        description: "Effective CPM of the recommended deal, if computable.",
      },
    },
    required: ["summary", "recommendedTerms", "draftReply", "rationale"],
  },
};

function buildSystemPrompt(rules: RulesConfig): string {
  return [
    "You are an expert influencer-deal negotiation assistant for Holafly's affiliate/account-executive team.",
    "You help the AE decide what to offer and draft the actual reply to send to the creator.",
    "",
    "## Brand context",
    rules.brandContext,
    "",
    "## Holafly negotiation rules (the guardrails you must work within)",
    `- Currency: ${rules.currency}.`,
    `- Format-specific CPM guardrails (target / hard cap), where CPM = fee ÷ projected views × 1000:`,
    `    • TikTok video: target €${rules.cpm.tiktok.target} / cap €${rules.cpm.tiktok.cap}`,
    `    • Instagram Reels: target €${rules.cpm.igReels.target} / cap €${rules.cpm.igReels.cap}`,
    `    • Instagram Stories/feed: target €${rules.cpm.igStoriesFeed.target} / cap €${rules.cpm.igStoriesFeed.cap}`,
    `    • YouTube integration: target €${rules.cpm.ytIntegration.target} / cap €${rules.cpm.ytIntegration.cap}`,
    `    • YouTube dedicated: target €${rules.cpm.ytDedicated.target} / cap €${rules.cpm.ytDedicated.cap}`,
    `- First collaboration: at least ${rules.minContentItemsFirstCollab} content items; apply a ${rules.bundleDiscountPctMin}-${rules.bundleDiscountPctMax}% bundle discount vs. ${rules.minContentItemsFirstCollab}× the single rate.`,
    `- Affiliate: commission up to ${rules.affiliate.maxCommissionPct}% (typical start ${rules.affiliate.defaultStartPct}%), ${rules.affiliate.cookieDays}-day cookie.`,
    `- Payment — first deal: ${rules.paymentTerms.firstDeal}; proven: ${rules.paymentTerms.proven}.`,
    `- Usage rights: default ${rules.usageRights.defaultWindowDays}-day window.${rules.usageRights.avoidPerpetual ? " Avoid perpetual rights." : ""}`,
    `- Exclusivity: ${rules.exclusivity.scopeNote} Named eSIM competitors: ${rules.exclusivity.competitors.join(", ")}.`,
    "- Deal templates by relationship stage:",
    `    • First: ${rules.dealTemplates.first}`,
    `    • Proven: ${rules.dealTemplates.proven}`,
    `    • Ambassador: ${rules.dealTemplates.ambassador}`,
    "",
    "## How to negotiate (principles)",
    "- Model the deal as separate line items (fee, deliverables, usage rights, exclusivity, payment terms, affiliate %, bonuses) — never one lump number.",
    "- Let the creator anchor the price; you anchor the structure. Use precise numbers.",
    "- Never give a concession for free — trade cheap things (timeline, organic repost, faster payment) for valuable ones (lower cash, narrower rights).",
    "- When a quote is too high: ask what's included, benchmark-check against the data, move the discussion off price to scope or a hybrid/affiliate structure, and decline gracefully if it still doesn't work.",
    "- Prefer low-cash, performance-weighted (affiliate) terms for first collaborations; reserve retainers for proven creators.",
    "- Base price on EFFECTIVE reach (real, in-target audience), not raw followers. Respect the CPM caps.",
    `- We aim for ROAS ≥ ${rules.roas.target}x. Use past-deal ROAS to size the offer: at/above ${rules.roas.target}x (strong) scale up — more budget, higher commission, or a retainer; below ${rules.roas.minimum}x (weak) reduce cash risk and lean on affiliate/performance terms.`,
    `- BONUS LEVER (special cases only): you may offer a performance bonus that pays out only if the deal reaches ROAS ≥ ${rules.roas.bonus}x. Use it to bridge a gap with a high-potential or proven creator without raising guaranteed cash — not by default. State the trigger and amount clearly when you use it.`,
    "- Be transparent: your rationale must cite the actual numbers and which rule applies.",
    "- Always keep the human (the AE) in control — you propose, they decide and send.",
    "",
    "Write the draftReply in English (unless the conversation is clearly in another language) as clean **Markdown**, formatted to read like a polished partnerships email:",
    "  - A warm 1-2 sentence opening.",
    "  - A short **What the data tells us** note citing effective (in-market) reach and the CPM-based fair-value range.",
    "  - When proposing or countering a package, an **Our offer** Markdown table with columns | Deliverable | Rate | and a bold total row.",
    "  - State the affiliate commission tier (and free eSIM) and frame the upside for the creator; if you use the special-case bonus, state its ROAS trigger and amount.",
    "  - A friendly call-to-action, then a sign-off ending with the lines '[Your name]' and 'Holafly Partnerships'.",
    "Keep it tight and human — use **bold** and short section headers, not walls of text. Then call provide_recommendation.",
  ].join("\n");
}

function buildContextBlock(
  negotiation: Negotiation,
  reports: Report[],
  pastDeals: PastDeal[],
  rules: RulesConfig
): string {
  const lines: string[] = [];
  lines.push("## Negotiation");
  lines.push(`Creator: ${negotiation.creatorName}${negotiation.creatorHandle ? ` (${negotiation.creatorHandle})` : ""}`);
  lines.push(`Platforms in play: ${negotiation.platforms.join(", ") || "n/a"}`);
  lines.push(`Relationship stage: ${negotiation.relationshipStage}`);
  lines.push(`Campaign / context: ${negotiation.campaign || "n/a"}`);
  lines.push(`Target budget: ${negotiation.budgetEur != null ? `€${negotiation.budgetEur}` : "not set"}`);
  lines.push("");
  lines.push("## Partner data (from HypeAuditor + our deterministic scoring)");
  if (reports.length === 0) {
    lines.push("No HypeAuditor reports uploaded yet. Reason from the conversation and ask for missing info if needed.");
  } else {
    for (const r of reports) {
      if (r.metrics && r.scores) {
        lines.push(summarizeScoresForPrompt(r.platform, r.metrics, r.scores, rules));
        lines.push("");
      }
    }
  }

  // Past performance / ROAS — key for proven affiliates.
  lines.push("## Past performance with this creator");
  if (pastDeals.length === 0) {
    lines.push("No past deals recorded.");
  } else {
    let totalSpend = 0;
    let totalRevenue = 0;
    for (const d of pastDeals) {
      if (d.spendEur != null) totalSpend += d.spendEur;
      if (d.revenueEur != null) totalRevenue += d.revenueEur;
      const r = computeRoas(d.spendEur, d.revenueEur);
      lines.push(
        `- ${d.label ?? "Deal"}${d.platform ? ` (${d.platform})` : ""}: spend €${d.spendEur ?? "n/a"}, ` +
          `revenue €${d.revenueEur ?? "n/a"}${d.conversions != null ? `, ${d.conversions} sales` : ""}, ` +
          `ROAS ${r != null ? r.toFixed(1) + "x" : "n/a"}${d.notes ? ` — ${d.notes}` : ""}`
      );
    }
    const blended = computeRoas(totalSpend, totalRevenue);
    lines.push(
      `Blended ROAS: ${blended != null ? blended.toFixed(1) + "x" : "n/a"} ` +
        `(total spend €${Math.round(totalSpend)}, total revenue €${Math.round(totalRevenue)}). ` +
        `Targets: aiming ≥ ${rules.roas.target}x, weak < ${rules.roas.minimum}x, special-case bonus at ${rules.roas.bonus}x. ` +
        `Calibrate the offer accordingly.`
    );
  }
  return lines.join("\n");
}

function buildTranscript(messages: Message[]): string {
  const roleLabel: Record<string, string> = {
    creator: "CREATOR",
    ae: "US (account exec)",
    assistant: "ASSISTANT (previous suggestion)",
    note: "INTERNAL NOTE",
  };
  if (messages.length === 0) return "(no messages yet — this is the opening of the negotiation)";
  return messages
    .map((m) => {
      if (m.role === "assistant" && m.recommendation) {
        return `${roleLabel[m.role]}: ${m.recommendation.summary}\n  (suggested terms: ${m.recommendation.recommendedTerms.structure})`;
      }
      return `${roleLabel[m.role] ?? m.role}: ${m.content}`;
    })
    .join("\n\n");
}

export interface AssistInput {
  negotiation: Negotiation;
  reports: Report[];
  messages: Message[];
  pastDeals: PastDeal[];
  rules: RulesConfig;
  /** Optional explicit instruction, e.g. the creator's latest message or "propose our opening offer". */
  ask?: string;
}

export async function runAssistant(input: AssistInput): Promise<AssistantRecommendation> {
  const { negotiation, reports, messages, pastDeals, rules, ask } = input;

  const contextBlock = buildContextBlock(negotiation, reports, pastDeals, rules);
  const transcript = buildTranscript(messages);
  const task =
    ask?.trim() ||
    (messages.length === 0
      ? "Propose our opening offer for this creator and draft the first outreach/negotiation message."
      : "Given the conversation so far, recommend our next move and draft our reply.");

  const msg = await client().messages.create({
    model: ASSISTANT_MODEL,
    max_tokens: 4096,
    temperature: 0.4,
    system: [
      { type: "text", text: buildSystemPrompt(rules), cache_control: { type: "ephemeral" } },
    ],
    tools: [RECOMMENDATION_TOOL],
    tool_choice: { type: "tool", name: RECOMMENDATION_TOOL.name },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: contextBlock, cache_control: { type: "ephemeral" } },
          {
            type: "text",
            text: `## Conversation so far\n${transcript}\n\n## Your task\n${task}`,
          },
        ],
      },
    ],
  });

  const rec = firstToolInput<AssistantRecommendation>(msg);
  // Defensive defaults so the UI never crashes on a missing array.
  rec.rationale ??= [];
  rec.ruleFlags ??= [];
  rec.concessionPlan ??= [];
  return rec;
}
