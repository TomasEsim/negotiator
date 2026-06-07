// Pure formatting helpers, safe to use on both server and client.

export function formatNumber(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return trim(n / 1_000_000) + "M";
  if (abs >= 1_000) return trim(n / 1_000) + "K";
  return String(Math.round(n));
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export function formatEur(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return "€" + Math.round(n).toLocaleString("en-US");
}

export function formatPct(n?: number | null, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toFixed(digits)}%`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function platformLabel(p: string): string {
  switch (p) {
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
    default:
      return "Unknown";
  }
}

export function computeRoas(
  spend?: number | null,
  revenue?: number | null
): number | null {
  if (spend == null || revenue == null || spend <= 0) return null;
  return revenue / spend;
}

export function formatRoas(r?: number | null): string {
  return r == null ? "—" : `${(Math.round(r * 10) / 10).toFixed(1)}×`;
}
