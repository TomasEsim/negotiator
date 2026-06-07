"use client";

import { marked } from "marked";
import type { AssistantRecommendation } from "@/lib/types";
import { formatEur } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import { Markdown } from "./Markdown";
import { Button } from "@/components/ui";

// Render the markdown draft to email-friendly HTML (inline-styled table) so the
// "Copy reply" button can place formatted content on the clipboard.
function draftToHtml(md: string): string {
  let body = marked.parse(md, { async: false }) as string;
  body = body
    .replace(/<table>/g, '<table style="border-collapse:collapse;width:100%;font-size:14px;margin:8px 0">')
    .replace(/<th(\s|>)/g, '<th style="border:1px solid #cbd5e1;background:#f1f5f9;padding:6px 8px;text-align:left"$1')
    .replace(/<td(\s|>)/g, '<td style="border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top"$1');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">${body}</div>`;
}

export function RecommendationView({
  rec,
  onUseAsReply,
}: {
  rec: AssistantRecommendation;
  onUseAsReply?: (text: string) => void;
}) {
  const t = rec.recommendedTerms;
  const termRows: [string, string | null | undefined][] = [
    ["Structure", t.structure],
    ["Flat fee", t.flatFeeEur != null ? formatEur(t.flatFeeEur) : null],
    ["Deliverables", t.deliverables],
    [
      "Affiliate",
      t.affiliateCommissionPct != null ? `${t.affiliateCommissionPct}% commission` : null,
    ],
    ["Usage rights", t.usageRights],
    ["Exclusivity", t.exclusivity],
    ["Payment", t.paymentTerms],
    ["Extras", t.otherIncentives],
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-800">{rec.summary}</p>

      {/* Recommended terms */}
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Recommended terms
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {termRows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex gap-2 text-sm">
                <dt className="shrink-0 font-medium text-slate-500">{k}:</dt>
                <dd className="text-slate-800">{v}</dd>
              </div>
            ))}
          {rec.estimatedDealCpmEur != null && (
            <div className="flex gap-2 text-sm">
              <dt className="shrink-0 font-medium text-slate-500">Effective CPM:</dt>
              <dd className="text-slate-800">€{rec.estimatedDealCpmEur}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Draft reply */}
      <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
            Draft reply to creator
          </span>
          <div className="flex items-center gap-2">
            <CopyButton
              text={rec.draftReply}
              html={draftToHtml(rec.draftReply)}
              label="Copy reply"
            />
            {onUseAsReply && (
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => onUseAsReply(rec.draftReply)}
              >
                Log as my reply
              </Button>
            )}
          </div>
        </div>
        <Markdown>{rec.draftReply}</Markdown>
      </div>

      {/* Rationale */}
      {rec.rationale.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Why
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-600">
            {rec.rationale.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Rule flags */}
      {rec.ruleFlags.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Watch-outs
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-800">
            {rec.ruleFlags.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Concession plan + walk-away */}
      {(rec.concessionPlan.length > 0 || rec.walkAwayPoint) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rec.concessionPlan.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                If they push back
              </div>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-600">
                {rec.concessionPlan.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {rec.walkAwayPoint && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Walk-away point
              </div>
              <p className="text-sm text-slate-600">{rec.walkAwayPoint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
