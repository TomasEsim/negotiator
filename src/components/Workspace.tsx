"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Sparkles, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Spinner, inputClass } from "@/components/ui";
import { ReportCard } from "./ReportCard";
import { RecommendationView } from "./RecommendationView";
import { PastDealsCard, type NewDeal } from "./PastDealsCard";
import { platformLabel, timeAgo } from "@/lib/format";
import type { RulesConfig } from "@/lib/rules";
import type {
  NegotiationDetail,
  NegotiationStatus,
  Platform,
  RelationshipStage,
} from "@/lib/types";

type ComposerRole = "creator" | "ae" | "note";

const PRESETS: { label: string; ask: string }[] = [
  {
    label: "Suggest opening offer",
    ask: "Propose our opening offer for this creator and draft the first outreach/negotiation message.",
  },
  {
    label: "Draft a counter",
    ask: "Draft a counter-offer responding to the creator's latest message, using our guardrails.",
  },
  {
    label: "Summarize & next steps",
    ask: "Summarize where this negotiation stands and recommend the next steps to close it.",
  },
];

const UPLOAD_OPTS: { value: Platform | "auto"; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
];

export function Workspace({
  initial,
  rules,
}: {
  initial: NegotiationDetail;
  rules: RulesConfig;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<NegotiationDetail>(initial);
  const id = initial.id;

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadPlatform, setUploadPlatform] = useState<Platform | "auto">("auto");

  const [composerText, setComposerText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [posting, setPosting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/negotiations/${id}`, { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      setDetail(j.negotiation);
    }
  }, [id]);

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadErrors([]);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    if (uploadPlatform !== "auto") fd.append("platform", uploadPlatform);
    try {
      const res = await fetch(`/api/negotiations/${id}/reports`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setUploadErrors([j.error || "Upload failed."]);
      else if (j.errors?.length) setUploadErrors(j.errors);
      await refresh();
    } catch (e) {
      setUploadErrors([(e as Error).message]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/negotiations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await refresh();
  }

  async function addMessage(role: ComposerRole, content: string) {
    const c = content.trim();
    if (!c) return;
    setPosting(true);
    await fetch(`/api/negotiations/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content: c }),
    });
    setComposerText("");
    await refresh();
    setPosting(false);
  }

  function logOnly(role: ComposerRole) {
    if (!composerText.trim()) return;
    void addMessage(role, composerText);
  }

  async function getRecommendation(ask?: string) {
    setGenerating(true);
    setGenError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (ask) payload.ask = ask;
      // Whatever is in the box is treated as the creator's latest message.
      if (composerText.trim()) payload.recordCreatorMessage = composerText.trim();
      const res = await fetch(`/api/negotiations/${id}/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenError(j.error || "Failed to generate recommendation.");
      } else {
        setComposerText("");
        setInstruction("");
      }
      await refresh();
    } catch (e) {
      setGenError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function addDeal(d: NewDeal) {
    await fetch(`/api/negotiations/${id}/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    await refresh();
  }

  async function removeDeal(dealId: string) {
    await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
    await refresh();
  }

  async function removeReport(reportId: string) {
    await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
    await refresh();
  }

  async function removeMessage(messageId: string) {
    await fetch(`/api/messages/${messageId}`, { method: "DELETE" });
    await refresh();
  }

  async function removeNegotiation() {
    if (!confirm("Delete this negotiation and all its data? This cannot be undone.")) return;
    await fetch(`/api/negotiations/${id}`, { method: "DELETE" });
    router.push("/");
  }

  // Contextual guidance — orient the user on what to do next.
  const hasReports = detail.reports.length > 0;
  const hasAssistant = detail.messages.some((m) => m.role === "assistant");
  const guide = !hasReports
    ? "Step 1 — Add the creator's HypeAuditor report in the Reports panel so the assistant works from real data."
    : !hasAssistant
    ? 'Step 2 — Paste the creator\'s message below (or click "Suggest opening offer") to get a recommended deal and reply.'
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> All negotiations
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{detail.creatorName}</h1>
            {detail.creatorHandle && (
              <span className="text-slate-500">{detail.creatorHandle}</span>
            )}
            {detail.platforms.map((p) => (
              <Badge key={p} color="slate">
                {platformLabel(p)}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Relationship stage"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={detail.relationshipStage}
              onChange={(e) =>
                patch({ relationshipStage: e.target.value as RelationshipStage })
              }
            >
              <option value="first">First collab</option>
              <option value="proven">Proven</option>
              <option value="ambassador">Ambassador</option>
            </select>
            <select
              aria-label="Status"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={detail.status}
              onChange={(e) => patch({ status: e.target.value as NegotiationStatus })}
            >
              <option value="active">Active</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[380px_1fr]">
        {/* ── Left: data ── */}
        <aside className="space-y-4">
          {/* Meta */}
          <Card>
            <CardHeader
              title="Deal context"
              action={
                <button
                  className="text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? "Done" : "Edit"}
                </button>
              }
            />
            <div className="space-y-2 p-3 text-sm">
              {editing ? (
                <EditMeta detail={detail} onSave={patch} onDone={() => setEditing(false)} />
              ) : (
                <>
                  <div className="text-slate-600">
                    <span className="text-slate-500">Campaign:</span>{" "}
                    {detail.campaign || "—"}
                  </div>
                  <div className="text-slate-600">
                    <span className="text-slate-500">Target budget:</span>{" "}
                    {detail.budgetEur != null ? `€${detail.budgetEur}` : "—"}
                  </div>
                  <button
                    onClick={removeNegotiation}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete negotiation
                  </button>
                </>
              )}
            </div>
          </Card>

          {/* Past deals & ROAS */}
          <PastDealsCard
            pastDeals={detail.pastDeals}
            roas={rules.roas}
            onAdd={addDeal}
            onDelete={removeDeal}
          />

          {/* Reports */}
          <Card>
            <CardHeader
              title="HypeAuditor reports"
              subtitle="Pick the channel, then choose the PDF(s)"
            />
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={(e) => onUpload(e.target.files)}
            />
            <div className="space-y-3 p-3">
              {/* Upload control with channel picker */}
              <div className="rounded-lg border border-dashed border-slate-300 p-3">
                <div className="mb-1.5 text-xs font-medium text-slate-600">
                  Which channel is this report?
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {UPLOAD_OPTS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      disabled={uploading}
                      onClick={() => setUploadPlatform(o.value)}
                      className={
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 " +
                        (uploadPlatform === o.value
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Spinner /> Reading with Claude…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {uploadPlatform === "auto"
                        ? "Choose PDF(s)"
                        : `Choose ${platformLabel(uploadPlatform)} PDF(s)`}
                    </>
                  )}
                </Button>
                <p className="mt-1.5 text-xs text-slate-500">
                  {uploadPlatform === "auto"
                    ? "We'll detect the channel from the report content."
                    : `These PDF(s) will be saved as ${platformLabel(uploadPlatform)} reports.`}
                </p>
                {uploadErrors.map((er, i) => (
                  <p key={i} className="mt-1 text-xs text-rose-600">
                    {er}
                  </p>
                ))}
              </div>

              {detail.reports.length === 0 && !uploading ? (
                <p className="text-sm text-slate-500">
                  No reports yet. Add the creator&apos;s HypeAuditor PDF(s) so the
                  assistant works from real data.
                </p>
              ) : (
                detail.reports.map((r) => (
                  <ReportCard key={r.id} report={r} onDelete={removeReport} />
                ))
              )}
            </div>
          </Card>

          {/* Guardrails */}
          <Card>
            <details>
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
                Active guardrails
              </summary>
              <div className="space-y-1 px-4 pb-3 text-xs text-slate-600">
                <div>CPM caps — TikTok €{rules.cpm.tiktok.cap}, Reels €{rules.cpm.igReels.cap}, IG Stories/feed €{rules.cpm.igStoriesFeed.cap}, YT integ. €{rules.cpm.ytIntegration.cap}, YT dedicated €{rules.cpm.ytDedicated.cap}</div>
                <div>Min content (first collab): {rules.minContentItemsFirstCollab} items, {rules.bundleDiscountPctMin}–{rules.bundleDiscountPctMax}% bundle discount</div>
                <div>Affiliate: up to {rules.affiliate.maxCommissionPct}% / {rules.affiliate.cookieDays}-day cookie</div>
                <div>ROAS: aim ≥ {rules.roas.target}×, bonus at {rules.roas.bonus}×, weak &lt; {rules.roas.minimum}×</div>
                <div>Exclusivity: named eSIM competitors only ({rules.exclusivity.competitors.slice(0, 4).join(", ")}…)</div>
                <Link href="/settings" className="inline-block pt-1 text-teal-600 hover:underline">
                  Edit rules →
                </Link>
              </div>
            </details>
          </Card>
        </aside>

        {/* ── Right: conversation + assistant ── */}
        <section className="space-y-4">
          {guide && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
              {guide}
            </div>
          )}

          {/* Thread */}
          <Card>
            <CardHeader
              title="Conversation"
              subtitle="Log what the creator says and what you send. The assistant reads the whole thread."
            />
            <div className="scroll-thin max-h-[55vh] space-y-3 overflow-y-auto p-3">
              {detail.messages.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-500">
                  <MessageSquare className="h-6 w-6 text-slate-300" aria-hidden />
                  <span>
                    Nothing logged yet. Add the creator&apos;s message below, or ask for an
                    opening offer.
                  </span>
                </div>
              ) : (
                detail.messages.map((m) => (
                  <div key={m.id} className="group">
                    {m.role === "assistant" && m.recommendation ? (
                      <div className="rounded-xl border border-teal-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <Badge color="teal">✨ AI suggestion</Badge>
                          <span className="text-xs text-slate-500">
                            {timeAgo(m.createdAt)}
                          </span>
                        </div>
                        <RecommendationView
                          rec={m.recommendation}
                          onUseAsReply={(text) => addMessage("ae", text)}
                        />
                        <button
                          onClick={() => removeMessage(m.id)}
                          className="mt-2 text-xs text-slate-300 hover:text-rose-500"
                        >
                          remove
                        </button>
                      </div>
                    ) : (
                      <MessageBubble
                        role={m.role}
                        content={m.content}
                        time={timeAgo(m.createdAt)}
                        onRemove={() => removeMessage(m.id)}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Continue — single action area (merged assistant + composer) */}
          <Card className="border-teal-300">
            <CardHeader
              title={
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-teal-600" /> Continue the negotiation
                </span>
              }
              subtitle="Paste the creator's message for a recommended reply, or pick a quick action."
            />
            <div className="space-y-3 p-3">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant="secondary"
                    className="text-xs"
                    disabled={generating}
                    onClick={() => getRecommendation(p.ask)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <textarea
                className={inputClass}
                rows={3}
                placeholder="Paste the creator's latest message here (or leave empty for an opening offer)…"
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Optional — what should the assistant focus on? (e.g. 'push for ≤ €300')"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !generating)
                    getRecommendation(instruction || undefined);
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span>Log without AI:</span>
                  {(
                    [
                      ["creator", "Creator"],
                      ["ae", "You"],
                      ["note", "Note"],
                    ] as [ComposerRole, string][]
                  ).map(([r, label]) => (
                    <button
                      key={r}
                      onClick={() => logOnly(r)}
                      disabled={posting || !composerText.trim()}
                      className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => getRecommendation(instruction || undefined)}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Spinner /> Thinking…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Get recommendation
                    </>
                  )}
                </Button>
              </div>
              {genError && <p className="text-sm text-rose-600">{genError}</p>}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  time,
  onRemove,
}: {
  role: string;
  content: string;
  time: string;
  onRemove: () => void;
}) {
  if (role === "note") {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
        📝 {content}
        <button onClick={onRemove} className="ml-2 text-slate-300 hover:text-rose-500">
          ✕
        </button>
      </div>
    );
  }
  const isAe = role === "ae";
  return (
    <div className={isAe ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm " +
          (isAe ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-800")
        }
      >
        <div
          className={
            "mb-0.5 text-[10px] font-semibold uppercase tracking-wide " +
            (isAe ? "text-teal-100" : "text-slate-500")
          }
        >
          {isAe ? "You" : "Creator"} · {time}
        </div>
        <p className="whitespace-pre-wrap">{content}</p>
        <button
          onClick={onRemove}
          className={
            "mt-1 text-[10px] " +
            (isAe ? "text-teal-200 hover:text-white" : "text-slate-300 hover:text-rose-500")
          }
        >
          remove
        </button>
      </div>
    </div>
  );
}

function EditMeta({
  detail,
  onSave,
  onDone,
}: {
  detail: NegotiationDetail;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onDone: () => void;
}) {
  const [creatorName, setCreatorName] = useState(detail.creatorName);
  const [creatorHandle, setCreatorHandle] = useState(detail.creatorHandle ?? "");
  const [campaign, setCampaign] = useState(detail.campaign ?? "");
  const [budget, setBudget] = useState(
    detail.budgetEur != null ? String(detail.budgetEur) : ""
  );

  return (
    <div className="space-y-2">
      <Field label="Creator name">
        <input
          className={inputClass}
          value={creatorName}
          onChange={(e) => setCreatorName(e.target.value)}
        />
      </Field>
      <Field label="Handle">
        <input
          className={inputClass}
          value={creatorHandle}
          onChange={(e) => setCreatorHandle(e.target.value)}
        />
      </Field>
      <Field label="Campaign / context">
        <textarea
          className={inputClass}
          rows={3}
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
        />
      </Field>
      <Field label="Target budget (€)">
        <input
          className={inputClass}
          value={budget}
          inputMode="decimal"
          onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </Field>
      <Button
        className="w-full"
        onClick={async () => {
          await onSave({
            creatorName: creatorName.trim() || detail.creatorName,
            creatorHandle: creatorHandle.trim() || null,
            campaign: campaign.trim() || null,
            budgetEur: budget ? Number(budget) : null,
          });
          onDone();
        }}
      >
        Save
      </Button>
    </div>
  );
}
