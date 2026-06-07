"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import type { EngagementVerdict, Report, RuleCheckStatus } from "@/lib/types";
import { Badge, Card, Stat, cn } from "@/components/ui";
import { formatEur, formatNumber, formatPct, platformLabel } from "@/lib/format";

const VERDICT_COLOR: Record<EngagementVerdict, string> = {
  excellent: "text-emerald-600",
  good: "text-teal-600",
  ok: "text-amber-600",
  poor: "text-rose-600",
  suspicious: "text-rose-600",
  unknown: "text-slate-500",
};

const CHECK_ICON: Record<RuleCheckStatus, { icon: string; color: string }> = {
  pass: { icon: "✓", color: "text-emerald-600" },
  warn: { icon: "!", color: "text-amber-600" },
  fail: { icon: "✕", color: "text-rose-600" },
};

const PLATFORM_COLOR = {
  instagram: "violet",
  tiktok: "slate",
  youtube: "red",
  unknown: "slate",
} as const;

export function ReportCard({
  report,
  onDelete,
  deleting,
}: {
  report: Report;
  onDelete: (id: string) => void;
  deleting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const m = report.metrics;
  const s = report.scores;

  if (!m || !s) {
    return (
      <Card className="p-3 text-sm text-slate-500">
        {report.filename}: could not read this report.
      </Card>
    );
  }

  const fair =
    s.fairPriceLowEur != null && s.fairPriceHighEur != null
      ? `${formatEur(s.fairPriceLowEur)}–${formatEur(s.fairPriceHighEur)}`
      : "—";

  return (
    <Card className="overflow-hidden">
      {/* Summary (always visible, click to expand) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/40"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-500 transition-transform",
              open && "rotate-180"
            )}
          />
          <Badge color={PLATFORM_COLOR[report.platform]}>
            {platformLabel(report.platform)}
          </Badge>
          <span className="truncate text-sm font-medium text-slate-800">
            {m.creatorHandle || m.creatorName || report.filename}
          </span>
          <Badge color="slate" className="ml-auto capitalize">
            {s.tier}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-6 text-xs text-slate-500">
          <span>{formatNumber(m.followers)} followers</span>
          <span className="text-slate-300">·</span>
          <span>
            ER{" "}
            <span className={cn("font-semibold", VERDICT_COLOR[s.engagementVerdict])}>
              {formatPct(m.engagementRatePct)}
            </span>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            Fit{" "}
            <span className="font-semibold text-slate-700">
              {s.audienceFitScore != null ? `${s.audienceFitScore}/100` : "—"}
            </span>
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-slate-700">{fair}/item</span>
        </div>
      </button>

      {/* Detail */}
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Followers" value={formatNumber(m.followers)} />
            <Stat
              label="Engagement"
              value={formatPct(m.engagementRatePct)}
              sub={s.engagementVerdict}
              color={VERDICT_COLOR[s.engagementVerdict]}
            />
            <Stat label="AQS" value={m.aqs != null ? `${m.aqs}/100` : "—"} />
            <Stat
              label="Audience fit"
              value={s.audienceFitScore != null ? `${s.audienceFitScore}/100` : "—"}
              sub={s.audienceFitLabel}
            />
            <Stat
              label="Effective reach"
              value={formatNumber(s.effectiveReach)}
              sub="real, in-market"
            />
            <Stat label="Fair / item" value={fair} />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>
              Target markets:{" "}
              <span className="font-medium text-slate-800">
                {formatPct(s.targetGeoPct, 0)}
              </span>
            </span>
            <span>
              Travel affinity:{" "}
              <span className="font-medium text-slate-800">
                {formatPct(s.travelAffinityPct, 0)}
              </span>
            </span>
            <span>
              Age in range:{" "}
              <span className="font-medium text-slate-800">
                {formatPct(s.targetAgePct, 0)}
              </span>
            </span>
            <span>
              Suspicious:{" "}
              <span className="font-medium text-slate-800">
                {formatPct(
                  (m.audienceSuspiciousPct ?? 0) + (m.audienceMassFollowersPct ?? 0),
                  0
                )}
              </span>
            </span>
          </div>

          {m.audienceByCountry && m.audienceByCountry.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {m.audienceByCountry.slice(0, 6).map((c) => (
                <span
                  key={c.country}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                >
                  {c.country} {formatPct(c.pct, 0)}
                </span>
              ))}
            </div>
          )}

          {s.ruleChecks.length > 0 && (
            <div className="space-y-1">
              {s.ruleChecks.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-xs">
                  <span className={`font-bold ${CHECK_ICON[c.status].color}`}>
                    {CHECK_ICON[c.status].icon}
                  </span>
                  <span className="text-slate-600">
                    <span className="font-medium text-slate-700">{c.label}:</span>{" "}
                    {c.detail}
                  </span>
                </div>
              ))}
            </div>
          )}

          {s.redFlags.length > 0 && (
            <div className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
              {s.redFlags.map((f, i) => (
                <div key={i}>⚠ {f}</div>
              ))}
            </div>
          )}
          {s.greenFlags.length > 0 && (
            <div className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
              {s.greenFlags.map((f, i) => (
                <div key={i}>✓ {f}</div>
              ))}
            </div>
          )}

          {m.extractionNotes && (
            <p className="text-xs italic text-slate-500">Note: {m.extractionNotes}</p>
          )}

          <button
            type="button"
            onClick={() => onDelete(report.id)}
            disabled={deleting}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove report
          </button>
        </div>
      )}
    </Card>
  );
}
