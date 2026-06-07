import { NextRequest } from "next/server";
import { deleteReport, getReport } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await getReport(id))) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteReport(id);
  return Response.json({ ok: true });
}
