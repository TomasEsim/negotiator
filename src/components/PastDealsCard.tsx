"use client";

import { useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { Badge, Button, Card, CardHeader, inputClass } from "@/components/ui";
import { computeRoas, formatEur, formatRoas, platformLabel } from "@/lib/format";
import type { PastDeal, Platform } from "@/lib/types";

type RoasColor = "green" | "amber" | "red" | "slate";

function roasColor(r: number | null, target: number, minimum: number): RoasColor {
  if (r == null) return "slate";
  if (r >= target) return "green";
  if (r >= minimum) return "amber";
  return "red";
}

export interface NewDeal {
  label: string;
  platform: Platform | null;
  spendEur: number | null;
  revenueEur: number | null;
  conversions: number | null;
  notes: string;
}

export function PastDealsCard({
  pastDeals,
  roas,
  onAdd,
  onDelete,
}: {
  pastDeals: PastDeal[];
  roas: { target: number; minimum: number };
  onAdd: (d: NewDeal) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [spend, setSpend] = useState("");
  const [revenue, setRevenue] = useState("");
  const [conversions, setConversions] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const totalSpend = pastDeals.reduce((s, d) => s + (d.spendEur ?? 0), 0);
  const totalRevenue = pastDeals.reduce((s, d) => s + (d.revenueEur ?? 0), 0);
  const blended = computeRoas(totalSpend, totalRevenue);

  async function submit() {
    setSaving(true);
    await onAdd({
      label: label.trim(),
      platform: platform || null,
      spendEur: spend ? Number(spend) : null,
      revenueEur: revenue ? Number(revenue) : null,
      conversions: conversions ? Number(conversions) : null,
      notes: notes.trim(),
    });
    setSaving(false);
    setOpen(false);
    setLabel("");
    setPlatform("");
    setSpend("");
    setRevenue("");
    setConversions("");
    setNotes("");
  }

  const money = (s: string, set: (v: string) => void, placeholder: string) => (
    <input
      className={inputClass}
      inputMode="decimal"
      placeholder={placeholder}
      value={s}
      onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ""))}
    />
  );

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-teal-600" /> Past deals &amp; ROAS
          </span>
        }
        subtitle="Track returns to calibrate the next offer"
        action={
          <button
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : (<><Plus className="h-3.5 w-3.5" /> Add deal</>)}
          </button>
        }
      />
      <div className="space-y-3 p-3">
        {pastDeals.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Blended ROAS
            </span>
            <span className="flex items-center gap-2 text-sm text-slate-600">
              {formatEur(totalSpend)} → {formatEur(totalRevenue)}
              <Badge color={roasColor(blended, roas.target, roas.minimum)}>
                {formatRoas(blended)}
              </Badge>
            </span>
          </div>
        )}

        {open && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <input
              className={inputClass}
              placeholder="Label (e.g. Mar 2026 Reel)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <select
              className={inputClass}
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform | "")}
            >
              <option value="">Channel (optional)</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              {money(spend, setSpend, "Spend €")}
              {money(revenue, setRevenue, "Revenue €")}
            </div>
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="Sales / conversions (optional)"
              value={conversions}
              onChange={(e) => setConversions(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <textarea
              className={inputClass}
              rows={2}
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button className="w-full" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save deal"}
            </Button>
          </div>
        )}

        {pastDeals.length === 0 && !open ? (
          <p className="text-sm text-slate-500">
            No past deals yet. Add one to factor real ROAS into the recommendation —
            most useful for proven affiliates you&apos;ve worked with before.
          </p>
        ) : (
          pastDeals.map((d) => {
            const r = computeRoas(d.spendEur, d.revenueEur);
            return (
              <div key={d.id} className="rounded-lg border border-slate-100 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    {d.label || "Deal"}
                    {d.platform && <Badge color="slate">{platformLabel(d.platform)}</Badge>}
                  </span>
                  <Badge color={roasColor(r, roas.target, roas.minimum)}>
                    {formatRoas(r)} ROAS
                  </Badge>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Spend {formatEur(d.spendEur)} → Revenue {formatEur(d.revenueEur)}
                  {d.conversions != null ? ` · ${d.conversions} sales` : ""}
                </div>
                {d.notes && <div className="text-xs text-slate-500">{d.notes}</div>}
                <button
                  onClick={() => onDelete(d.id)}
                  className="mt-1 text-xs text-slate-300 hover:text-rose-500"
                >
                  remove
                </button>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
