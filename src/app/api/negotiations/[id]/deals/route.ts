import { NextRequest } from "next/server";
import { addPastDeal, getNegotiation } from "@/lib/db";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube"];

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await getNegotiation(id))) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const deal = await addPastDeal({
    negotiationId: id,
    label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : null,
    platform: PLATFORMS.includes(body.platform) ? body.platform : null,
    spendEur: num(body.spendEur),
    revenueEur: num(body.revenueEur),
    conversions: num(body.conversions),
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
  });
  return Response.json({ deal }, { status: 201 });
}
