import { NextRequest } from "next/server";
import { deleteNegotiation, getNegotiationDetail, updateNegotiation } from "@/lib/db";
import type { NegotiationStatus, Platform, RelationshipStage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const negotiation = await getNegotiationDetail(id);
  if (!negotiation) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ negotiation });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateNegotiation(id, {
    creatorName: body.creatorName,
    creatorHandle: body.creatorHandle,
    platforms: body.platforms as Platform[] | undefined,
    campaign: body.campaign,
    budgetEur: body.budgetEur,
    relationshipStage: body.relationshipStage as RelationshipStage | undefined,
    status: body.status as NegotiationStatus | undefined,
  });
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ negotiation: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteNegotiation(id);
  return Response.json({ ok: true });
}
