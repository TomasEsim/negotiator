import Link from "next/link";
import { ChevronRight, FileText, Handshake, MessageSquare, Plus } from "lucide-react";
import { listNegotiations } from "@/lib/db";
import { Badge, Button, Card, EmptyState, cn } from "@/components/ui";
import { platformLabel, timeAgo } from "@/lib/format";
import type { Platform, RelationshipStage } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS = {
  active: { color: "blue", label: "Active", dot: "bg-sky-500" },
  won: { color: "green", label: "Won", dot: "bg-emerald-500" },
  lost: { color: "red", label: "Lost", dot: "bg-rose-500" },
  paused: { color: "amber", label: "Paused", dot: "bg-amber-500" },
} as const;

const STAGE_LABEL: Record<RelationshipStage, string> = {
  first: "First collab",
  proven: "Proven",
  ambassador: "Ambassador",
};

const PLATFORM_COLOR = {
  instagram: "violet",
  tiktok: "slate",
  youtube: "red",
  unknown: "slate",
} as const;

export default async function Home() {
  const negotiations = await listNegotiations();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Negotiations</h1>
          <p className="text-sm text-slate-500">
            Track creator deals, upload HypeAuditor reports, and get data-backed offers.
          </p>
        </div>
        <Link href="/negotiations/new">
          <Button>
            <Plus className="h-4 w-4" /> New negotiation
          </Button>
        </Link>
      </div>

      {negotiations.length === 0 ? (
        <EmptyState
          icon={<Handshake className="h-6 w-6" aria-hidden />}
          title="No negotiations yet"
          description="Start one to upload a creator's HypeAuditor report and get a recommended offer with the reasoning behind it."
          action={
            <Link href="/negotiations/new">
              <Button>
                <Plus className="h-4 w-4" /> New negotiation
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {negotiations.map((n) => (
            <Link key={n.id} href={`/negotiations/${n.id}`} className="block">
              <Card className="group flex items-center gap-4 px-4 py-3 transition hover:border-teal-300 hover:shadow-md">
                <span
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STATUS[n.status].dot)}
                  title={STATUS[n.status].label}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-800">
                      {n.creatorName}
                    </span>
                    {n.creatorHandle && (
                      <span className="truncate text-sm text-slate-500">
                        {n.creatorHandle}
                      </span>
                    )}
                    <Badge color={STATUS[n.status].color}>{STATUS[n.status].label}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">
                      {STAGE_LABEL[n.relationshipStage]}
                    </span>
                    {n.platforms.map((p: Platform) => (
                      <Badge key={p} color={PLATFORM_COLOR[p]}>
                        {platformLabel(p)}
                      </Badge>
                    ))}
                    {n.campaign && (
                      <span className="max-w-[22rem] truncate text-slate-500">
                        · {n.campaign}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1" title="Reports">
                    <FileText className="h-3.5 w-3.5" /> {n.reportCount}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Messages">
                    <MessageSquare className="h-3.5 w-3.5" /> {n.messageCount}
                  </span>
                  <span className="w-14 text-right">{timeAgo(n.updatedAt)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-teal-600" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
