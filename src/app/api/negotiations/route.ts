import { NextRequest } from "next/server";
import { createNegotiation, listNegotiations } from "@/lib/db";
import type { Platform, RelationshipStage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ negotiations: await listNegotiations() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const creatorName = (body.creatorName ?? "").toString().trim();
  if (!creatorName) {
    return Response.json({ error: "creatorName is required" }, { status: 400 });
  }
  const negotiation = await createNegotiation({
    creatorName,
    creatorHandle: body.creatorHandle ?? null,
    platforms: (Array.isArray(body.platforms) ? body.platforms : []) as Platform[],
    campaign: body.campaign ?? null,
    budgetEur: typeof body.budgetEur === "number" ? body.budgetEur : null,
    relationshipStage: (body.relationshipStage ?? "first") as RelationshipStage,
  });
  return Response.json({ negotiation }, { status: 201 });
}
