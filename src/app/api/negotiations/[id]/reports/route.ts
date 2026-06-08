import { NextRequest } from "next/server";
import { addReport, getNegotiation, getRules, updateNegotiation } from "@/lib/db";
import { extractReportFromPdf, MissingApiKeyError } from "@/lib/anthropic";
import { scoreReport } from "@/lib/scoring";
import type { Platform, Report } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // vision extraction takes time

function platformFromName(name: string): Platform {
  const n = name.toLowerCase();
  if (n.includes("instagram") || n.includes("insta")) return "instagram";
  if (n.includes("tiktok") || n.includes("tik-tok") || n.includes("tik_tok")) return "tiktok";
  if (n.includes("youtube") || n.includes("_yt_") || n.endsWith("yt")) return "youtube";
  return "unknown";
}

// An explicit channel chosen in the UI overrides filename/content detection.
function parsePlatformField(v: unknown): Platform | null {
  if (v === "instagram" || v === "tiktok" || v === "youtube") return v;
  return null;
}

async function cleanupBlobs(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(urls);
  } catch {
    /* best-effort cleanup */
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const negotiation = await getNegotiation(id);
  if (!negotiation) return Response.json({ error: "Negotiation not found" }, { status: 404 });

  const rules = await getRules();
  const created: Report[] = [];
  const errors: string[] = [];
  const platformsSeen = new Set<Platform>(negotiation.platforms);
  const contentType = req.headers.get("content-type") || "";

  // Collect (bytes, filename) from either Blob URLs (production) or multipart (local).
  const incoming: { buf: Buffer; filename: string }[] = [];
  const blobsToDelete: string[] = [];
  let forced: Platform | null = null;

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    forced = parsePlatformField(body.platform);
    const items = Array.isArray(body.items) ? body.items : [];
    for (const it of items) {
      const url = typeof it?.url === "string" ? it.url : null;
      const filename = typeof it?.filename === "string" ? it.filename : "report.pdf";
      if (!url) {
        errors.push(`${filename}: missing upload URL`);
        continue;
      }
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          errors.push(`${filename}: could not read the uploaded file`);
          continue;
        }
        incoming.push({ buf: Buffer.from(await resp.arrayBuffer()), filename });
        blobsToDelete.push(url);
      } catch (e) {
        errors.push(`${filename}: ${(e as Error).message}`);
      }
    }
  } else {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return Response.json({ error: "Expected multipart/form-data or JSON" }, { status: 400 });
    }
    forced = parsePlatformField(form.get("platform"));
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    for (const file of files) {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        errors.push(`${file.name}: not a PDF`);
        continue;
      }
      incoming.push({ buf: Buffer.from(await file.arrayBuffer()), filename: file.name });
    }
  }

  if (incoming.length === 0) {
    return Response.json(
      { error: errors[0] || "No files uploaded", errors },
      { status: errors.length ? 200 : 400 }
    );
  }

  for (const { buf, filename } of incoming) {
    try {
      const base64 = buf.toString("base64");
      const hint = forced ?? platformFromName(filename);
      const metrics = await extractReportFromPdf(base64, hint);
      const platform = metrics.platform ?? "unknown";
      const scores = scoreReport(metrics, rules);
      const report = await addReport({
        negotiationId: id,
        platform,
        filename,
        metrics,
        scores,
      });
      created.push(report);
      if (platform !== "unknown") platformsSeen.add(platform);
    } catch (e) {
      if (e instanceof MissingApiKeyError) {
        await cleanupBlobs(blobsToDelete);
        return Response.json({ error: e.message }, { status: 400 });
      }
      errors.push(`${filename}: ${(e as Error).message}`);
    }
  }

  await cleanupBlobs(blobsToDelete);

  if (created.length > 0) {
    await updateNegotiation(id, { platforms: Array.from(platformsSeen) });
  }

  return Response.json({ reports: created, errors });
}
