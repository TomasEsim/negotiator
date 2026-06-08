import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Issues short-lived client tokens so the browser can upload large PDFs directly
// to Vercel Blob storage — bypassing the 4.5 MB serverless request-body limit.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: 40 * 1024 * 1024, // 40 MB (HypeAuditor PDFs are ~10-12 MB)
      }),
      // Not used: the client calls the reports route directly with the blob URL.
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
