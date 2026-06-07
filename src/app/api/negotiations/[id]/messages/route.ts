import { NextRequest } from "next/server";
import { addMessage, getNegotiation } from "@/lib/db";
import type { MessageRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLES: MessageRole[] = ["creator", "ae", "assistant", "note"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await getNegotiation(id))) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const role: MessageRole = ROLES.includes(body.role) ? body.role : "note";
  const content = (body.content ?? "").toString().trim();
  if (!content) return Response.json({ error: "content is required" }, { status: 400 });

  const message = await addMessage({ negotiationId: id, role, content });
  return Response.json({ message }, { status: 201 });
}
