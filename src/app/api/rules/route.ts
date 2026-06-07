import { NextRequest } from "next/server";
import { getRules, resetRules, saveRules } from "@/lib/db";
import { DEFAULT_RULES, type RulesConfig } from "@/lib/rules";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ rules: await getRules(), defaults: DEFAULT_RULES });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const incoming = body?.rules ?? body;
  if (!incoming || typeof incoming !== "object") {
    return Response.json({ error: "Invalid rules payload" }, { status: 400 });
  }
  // Merge over defaults so any missing field falls back to a sane value.
  const merged = { ...DEFAULT_RULES, ...(incoming as Partial<RulesConfig>) } as RulesConfig;
  return Response.json({ rules: await saveRules(merged) });
}

// Reset to defaults
export async function POST() {
  return Response.json({ rules: await resetRules() });
}
