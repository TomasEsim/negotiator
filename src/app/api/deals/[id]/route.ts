import { NextRequest } from "next/server";
import { deletePastDeal, getPastDeal } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await getPastDeal(id))) return Response.json({ error: "Not found" }, { status: 404 });
  await deletePastDeal(id);
  return Response.json({ ok: true });
}
