import { NextRequest } from "next/server";
import {
  addMessage,
  getNegotiation,
  getRules,
  listMessages,
  listPastDeals,
  listReports,
} from "@/lib/db";
import { MissingApiKeyError, runAssistant } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const negotiation = await getNegotiation(id);
  if (!negotiation) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const ask = typeof body.ask === "string" && body.ask.trim() ? body.ask.trim() : undefined;

  // Optionally record the creator's latest message before generating advice.
  const creatorMsg =
    typeof body.recordCreatorMessage === "string" ? body.recordCreatorMessage.trim() : "";
  if (creatorMsg) {
    await addMessage({ negotiationId: id, role: "creator", content: creatorMsg });
  }

  try {
    const rules = await getRules();
    const reports = await listReports(id);
    const messages = await listMessages(id);
    const pastDeals = await listPastDeals(id);
    const recommendation = await runAssistant({
      negotiation,
      reports,
      messages,
      pastDeals,
      rules,
      ask,
    });
    const message = await addMessage({
      negotiationId: id,
      role: "assistant",
      content: recommendation.summary,
      recommendation,
    });
    return Response.json({ message, recommendation });
  } catch (e) {
    if (e instanceof MissingApiKeyError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
