export const dynamic = "force-dynamic";

// Tells the client whether direct-to-storage uploads (Vercel Blob) are available.
// True in production when a Blob store is linked; false locally → multipart fallback.
export function GET() {
  return Response.json({ blob: !!process.env.BLOB_READ_WRITE_TOKEN });
}
