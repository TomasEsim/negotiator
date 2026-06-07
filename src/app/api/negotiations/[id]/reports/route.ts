import { NextRequest } from "next/server";
import { addReport, getNegotiation, getRules, updateNegotiation } from "@/lib/db";
import { extractReportFromPdf, MissingApiKeyError } from "@/lib/anthropic";
import { scoreReport } from "@/lib/scoring";
import type { Platform, Report } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // vision extraction can take a while

function platformFromName(name: string): Platform {
  const n = name.toLowerCase();
  if (n.includes("instagram") || n.includes("insta")) return "instagram";
  if (n.includes("tiktok") || n.includes("tik-tok") || n.includes("tik_tok")) return "tiktok";
  if (n.includes("youtube") || n.includes("_yt_") || n.endsWith("yt")) return "youtube";
  return "unknown";
}

// An explicit channel chosen in the UI overrides filename/content detection.
function parsePlatformField(v: FormDataEntryValue | null): Platform | null {
  if (v === "instagram" || v === "tiktok" || v === "youtube") return v;
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const negotiation = await getNegotiation(id);
  if (!negotiation) return Response.json({ error: "Negotiation not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }

  const rules = await getRules();
  const created: Report[] = [];
  const errors: string[] = [];
  const platformsSeen = new Set<Platform>(negotiation.platforms);
  // If the user picked a channel in the UI, it applies to every file in this upload.
  const forcedPlatform = parsePlatformField(form.get("platform"));

  for (const file of files) {
    try {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        errors.push(`${file.name}: not a PDF`);
        continue;
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const base64 = buf.toString("base64");
      const hint = forcedPlatform ?? platformFromName(file.name);
      const metrics = await extractReportFromPdf(base64, hint);
      const platform = metrics.platform ?? "unknown";
      const scores = scoreReport(metrics, rules);

      // We don't persist the raw PDF — serverless filesystems are ephemeral, and
      // we never serve it back. The extracted metrics + scores are what we keep.
      const report = await addReport({
        negotiationId: id,
        platform,
        filename: file.name,
        metrics,
        scores,
      });
      created.push(report);
      if (platform !== "unknown") platformsSeen.add(platform);
    } catch (e) {
      if (e instanceof MissingApiKeyError) {
        return Response.json({ error: e.message }, { status: 400 });
      }
      errors.push(`${file.name}: ${(e as Error).message}`);
    }
  }

  if (created.length > 0) {
    await updateNegotiation(id, { platforms: Array.from(platformsSeen) });
  }

  return Response.json({ reports: created, errors });
}
