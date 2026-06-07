"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { platformLabel } from "@/lib/format";
import type { Platform, RelationshipStage } from "@/lib/types";

const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube"];

export default function NewNegotiationPage() {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState("");
  const [creatorHandle, setCreatorHandle] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [campaign, setCampaign] = useState("");
  const [budget, setBudget] = useState("");
  const [stage, setStage] = useState<RelationshipStage>("first");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!creatorName.trim()) {
      setError("Creator name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/negotiations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorName: creatorName.trim(),
        creatorHandle: creatorHandle.trim() || null,
        platforms,
        campaign: campaign.trim() || null,
        budgetEur: budget ? Number(budget) : null,
        relationshipStage: stage,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Failed to create negotiation.");
      setSaving(false);
      return;
    }
    const { negotiation } = await res.json();
    router.push(`/negotiations/${negotiation.id}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">New negotiation</h1>
      </div>

      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Creator name *">
            <input
              className={inputClass}
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="e.g. Super Enthused"
              autoFocus
            />
          </Field>

          <Field label="Handle">
            <input
              className={inputClass}
              value={creatorHandle}
              onChange={(e) => setCreatorHandle(e.target.value)}
              placeholder="@superenthused"
            />
          </Field>

          <Field label="Platforms in play" hint="You can also let the report upload detect these.">
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={
                    "rounded-lg border px-3 py-1.5 text-sm transition " +
                    (platforms.includes(p)
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")
                  }
                >
                  {platformLabel(p)}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Relationship stage">
              <select
                className={inputClass}
                value={stage}
                onChange={(e) => setStage(e.target.value as RelationshipStage)}
              >
                <option value="first">First collaboration</option>
                <option value="proven">Proven creator</option>
                <option value="ambassador">Ambassador</option>
              </select>
            </Field>
            <Field label="Target budget (€)" hint="Optional">
              <input
                className={inputClass}
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="e.g. 500"
              />
            </Field>
          </div>

          <Field label="Campaign / context" hint="Optional — what's this collaboration about?">
            <textarea
              className={inputClass}
              rows={3}
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="e.g. Summer Europe travel push — want a Reel + Stories with discount code."
            />
          </Field>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Link href="/">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving ? (
                "Creating…"
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Create negotiation
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
