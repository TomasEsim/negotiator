"use client";

import { useState, type ReactNode } from "react";
import { Button, Card, CardHeader, cn, inputClass } from "@/components/ui";
import type { CpmBand, RulesConfig } from "@/lib/rules";

function parseList(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function Num({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        step={step}
        className={inputClass}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </label>
  );
}

function Txt({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <textarea
        className={inputClass}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="p-4">{children}</div>
    </Card>
  );
}

const CPM_LABELS: Record<keyof RulesConfig["cpm"], string> = {
  tiktok: "TikTok video",
  igReels: "Instagram Reels",
  igStoriesFeed: "IG Stories / feed",
  ytIntegration: "YouTube integration",
  ytDedicated: "YouTube dedicated",
};

const TABS = [
  { id: "brand", label: "Brand" },
  { id: "pricing", label: "Pricing" },
  { id: "audience", label: "Audience & targeting" },
  { id: "deal", label: "Deal posture" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function RulesEditor({ initial }: { initial: RulesConfig }) {
  const [r, setR] = useState<RulesConfig>(initial);
  const [tab, setTab] = useState<TabId>("brand");
  const [marketsText, setMarketsText] = useState(initial.targetMarkets.join(", "));
  const [languagesText, setLanguagesText] = useState(initial.targetLanguages.join(", "));
  const [keywordsText, setKeywordsText] = useState(initial.travelInterestKeywords.join(", "));
  const [competitorsText, setCompetitorsText] = useState(
    initial.exclusivity.competitors.join(", ")
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setCpm(band: keyof RulesConfig["cpm"], field: keyof CpmBand, value: number) {
    setR((prev) => ({
      ...prev,
      cpm: { ...prev.cpm, [band]: { ...prev.cpm[band], [field]: value } },
    }));
  }

  function buildConfig(): RulesConfig {
    return {
      ...r,
      targetMarkets: parseList(marketsText),
      targetLanguages: parseList(languagesText),
      travelInterestKeywords: parseList(keywordsText),
      exclusivity: { ...r.exclusivity, competitors: parseList(competitorsText) },
    };
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: buildConfig() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Failed to save.");
      } else {
        const j = await res.json();
        setR(j.rules);
        setSavedAt(new Date().toLocaleTimeString());
      }
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("Reset all rules to the research-based defaults?")) return;
    setSaving(true);
    const res = await fetch("/api/rules", { method: "POST" });
    const j = await res.json();
    const d: RulesConfig = j.rules;
    setR(d);
    setMarketsText(d.targetMarkets.join(", "));
    setLanguagesText(d.targetLanguages.join(", "));
    setKeywordsText(d.travelInterestKeywords.join(", "));
    setCompetitorsText(d.exclusivity.competitors.join(", "));
    setSavedAt(new Date().toLocaleTimeString());
    setSaving(false);
  }

  const weightSum =
    r.fitWeights.geography +
    r.fitWeights.interests +
    r.fitWeights.age +
    r.fitWeights.authenticity +
    r.fitWeights.language;

  return (
    <div className="space-y-4">
      <div className="sticky top-[57px] z-10 -mx-4 border-b border-slate-200 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Rules &amp; Settings</h1>
            <p className="text-xs text-slate-500">
              These guardrails drive the scoring and the assistant.{" "}
              {savedAt && <span className="text-emerald-600">Saved at {savedAt}.</span>}
              {error && <span className="text-rose-600">{error}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} disabled={saving}>
              Reset to defaults
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40",
                tab === t.id
                  ? "bg-teal-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "brand" && (
        <Section
          title="Brand context"
          subtitle="Injected into the assistant so its replies sound like Holafly."
        >
          <Area
            label="Brand context"
            rows={6}
            value={r.brandContext}
            onChange={(v) => setR({ ...r, brandContext: v })}
          />
        </Section>
      )}

      {tab === "pricing" && (
        <div className="space-y-4">
          <Section
            title="CPM guardrails (€)"
            subtitle="Per 1,000 views/impressions. Target = aim for; Cap = hard ceiling (the assistant flags above it)."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(CPM_LABELS) as (keyof RulesConfig["cpm"])[]).map((band) => (
                <div key={band} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    {CPM_LABELS[band]}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Num
                      label="Target"
                      value={r.cpm[band].target}
                      onChange={(n) => setCpm(band, "target", n)}
                    />
                    <Num
                      label="Cap"
                      value={r.cpm[band].cap}
                      onChange={(n) => setCpm(band, "cap", n)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Content & bundles">
            <div className="grid gap-3 sm:grid-cols-3">
              <Num
                label="Min content items (first collab)"
                value={r.minContentItemsFirstCollab}
                onChange={(n) => setR({ ...r, minContentItemsFirstCollab: n })}
              />
              <Num
                label="Bundle discount min (%)"
                value={r.bundleDiscountPctMin}
                onChange={(n) => setR({ ...r, bundleDiscountPctMin: n })}
              />
              <Num
                label="Bundle discount max (%)"
                value={r.bundleDiscountPctMax}
                onChange={(n) => setR({ ...r, bundleDiscountPctMax: n })}
              />
            </div>
          </Section>

          <Section title="Affiliate / commission">
            <div className="grid gap-3 sm:grid-cols-3">
              <Num
                label="Max commission (%)"
                value={r.affiliate.maxCommissionPct}
                onChange={(n) => setR({ ...r, affiliate: { ...r.affiliate, maxCommissionPct: n } })}
              />
              <Num
                label="Default start (%)"
                value={r.affiliate.defaultStartPct}
                onChange={(n) => setR({ ...r, affiliate: { ...r.affiliate, defaultStartPct: n } })}
              />
              <Num
                label="Cookie window (days)"
                value={r.affiliate.cookieDays}
                onChange={(n) => setR({ ...r, affiliate: { ...r.affiliate, cookieDays: n } })}
              />
            </div>
          </Section>

          <Section
            title="ROAS targets"
            subtitle="Return on ad spend (revenue ÷ spend). We aim for the target; the bonus threshold is a special-case performance lever the assistant can offer to bridge a gap."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Num
                label="Aiming for (≥)"
                value={r.roas.target}
                step={0.1}
                onChange={(n) => setR({ ...r, roas: { ...r.roas, target: n } })}
              />
              <Num
                label="Bonus threshold (≥)"
                value={r.roas.bonus}
                step={0.1}
                onChange={(n) => setR({ ...r, roas: { ...r.roas, bonus: n } })}
              />
              <Num
                label="Weak (below)"
                value={r.roas.minimum}
                step={0.1}
                onChange={(n) => setR({ ...r, roas: { ...r.roas, minimum: n } })}
              />
            </div>
          </Section>
        </div>
      )}

      {tab === "audience" && (
        <div className="space-y-4">
          <Section
            title="Audience quality gates"
            subtitle="Drive the pass / warn / fail checks on each report."
          >
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Num
                label="Fail below AQS"
                value={r.audienceGates.minAqs}
                onChange={(n) => setR({ ...r, audienceGates: { ...r.audienceGates, minAqs: n } })}
              />
              <Num
                label="Warn below AQS"
                value={r.audienceGates.warnAqs}
                onChange={(n) => setR({ ...r, audienceGates: { ...r.audienceGates, warnAqs: n } })}
              />
              <Num
                label="Max suspicious (%)"
                value={r.audienceGates.maxSuspiciousPct}
                onChange={(n) =>
                  setR({ ...r, audienceGates: { ...r.audienceGates, maxSuspiciousPct: n } })
                }
              />
              <Num
                label="Min target geo (%)"
                value={r.audienceGates.minTargetGeoPct}
                onChange={(n) =>
                  setR({ ...r, audienceGates: { ...r.audienceGates, minTargetGeoPct: n } })
                }
              />
              <Num
                label="Min engagement (%)"
                value={r.audienceGates.minEngagementRatePct}
                step={0.1}
                onChange={(n) =>
                  setR({ ...r, audienceGates: { ...r.audienceGates, minEngagementRatePct: n } })
                }
              />
            </div>
          </Section>

          <Section
            title="Audience-fit weights"
            subtitle={`How much each factor counts toward the 0-100 fit score. Currently sums to ${weightSum} (auto-normalised).`}
          >
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Num
                label="Geography"
                value={r.fitWeights.geography}
                onChange={(n) => setR({ ...r, fitWeights: { ...r.fitWeights, geography: n } })}
              />
              <Num
                label="Interests"
                value={r.fitWeights.interests}
                onChange={(n) => setR({ ...r, fitWeights: { ...r.fitWeights, interests: n } })}
              />
              <Num
                label="Age"
                value={r.fitWeights.age}
                onChange={(n) => setR({ ...r, fitWeights: { ...r.fitWeights, age: n } })}
              />
              <Num
                label="Authenticity"
                value={r.fitWeights.authenticity}
                onChange={(n) => setR({ ...r, fitWeights: { ...r.fitWeights, authenticity: n } })}
              />
              <Num
                label="Language"
                value={r.fitWeights.language}
                onChange={(n) => setR({ ...r, fitWeights: { ...r.fitWeights, language: n } })}
              />
            </div>
          </Section>

          <Section title="Targeting" subtitle="Who Holafly wants to reach. Comma-separated.">
            <div className="space-y-3">
              <Area
                label="Target markets (countries)"
                value={marketsText}
                onChange={setMarketsText}
                hint="Audience % in these countries counts toward target-geo and fit."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Txt label="Target languages" value={languagesText} onChange={setLanguagesText} />
                <div className="grid grid-cols-2 gap-2">
                  <Num
                    label="Target age min"
                    value={r.targetAgeMin}
                    onChange={(n) => setR({ ...r, targetAgeMin: n })}
                  />
                  <Num
                    label="Target age max"
                    value={r.targetAgeMax}
                    onChange={(n) => setR({ ...r, targetAgeMax: n })}
                  />
                </div>
              </div>
              <Area
                label="Travel-interest keywords"
                value={keywordsText}
                onChange={setKeywordsText}
                hint="Audience interests matching these count as travel affinity."
              />
            </div>
          </Section>
        </div>
      )}

      {tab === "deal" && (
        <div className="space-y-4">
          <Section title="Deal posture">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Txt
                  label="Payment — first deal"
                  value={r.paymentTerms.firstDeal}
                  onChange={(v) => setR({ ...r, paymentTerms: { ...r.paymentTerms, firstDeal: v } })}
                />
                <Txt
                  label="Payment — proven creator"
                  value={r.paymentTerms.proven}
                  onChange={(v) => setR({ ...r, paymentTerms: { ...r.paymentTerms, proven: v } })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Num
                  label="Default usage-rights window (days)"
                  value={r.usageRights.defaultWindowDays}
                  onChange={(n) =>
                    setR({ ...r, usageRights: { ...r.usageRights, defaultWindowDays: n } })
                  }
                />
                <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={r.usageRights.avoidPerpetual}
                    onChange={(e) =>
                      setR({
                        ...r,
                        usageRights: { ...r.usageRights, avoidPerpetual: e.target.checked },
                      })
                    }
                  />
                  Avoid perpetual usage rights
                </label>
              </div>
              <Txt
                label="Exclusivity scope note"
                value={r.exclusivity.scopeNote}
                onChange={(v) => setR({ ...r, exclusivity: { ...r.exclusivity, scopeNote: v } })}
              />
              <Txt
                label="Named eSIM competitors"
                value={competitorsText}
                onChange={setCompetitorsText}
              />
            </div>
          </Section>

          <Section title="Deal templates by relationship stage">
            <div className="space-y-3">
              <Area
                label="First collaboration"
                value={r.dealTemplates.first}
                onChange={(v) => setR({ ...r, dealTemplates: { ...r.dealTemplates, first: v } })}
              />
              <Area
                label="Proven creator"
                value={r.dealTemplates.proven}
                onChange={(v) => setR({ ...r, dealTemplates: { ...r.dealTemplates, proven: v } })}
              />
              <Area
                label="Ambassador"
                value={r.dealTemplates.ambassador}
                onChange={(v) =>
                  setR({ ...r, dealTemplates: { ...r.dealTemplates, ambassador: v } })
                }
              />
            </div>
          </Section>

          <Section title="Follower-tier boundaries" subtitle="Max followers for each tier.">
            <div className="grid gap-3 sm:grid-cols-4">
              <Num
                label="Nano max"
                value={r.tiers.nanoMax}
                step={1000}
                onChange={(n) => setR({ ...r, tiers: { ...r.tiers, nanoMax: n } })}
              />
              <Num
                label="Micro max"
                value={r.tiers.microMax}
                step={1000}
                onChange={(n) => setR({ ...r, tiers: { ...r.tiers, microMax: n } })}
              />
              <Num
                label="Mid max"
                value={r.tiers.midMax}
                step={1000}
                onChange={(n) => setR({ ...r, tiers: { ...r.tiers, midMax: n } })}
              />
              <Num
                label="Macro max"
                value={r.tiers.macroMax}
                step={1000}
                onChange={(n) => setR({ ...r, tiers: { ...r.tiers, macroMax: n } })}
              />
            </div>
          </Section>
        </div>
      )}

      <div className="flex justify-end gap-2 pb-8">
        <Button variant="secondary" onClick={reset} disabled={saving}>
          Reset to defaults
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
