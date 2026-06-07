import { NextResponse, type NextRequest } from "next/server";

// Lightweight shared-password gate (HTTP Basic Auth). Enabled only when
// APP_PASSWORD is set — so local dev (no env) is ungated, and production on
// Vercel requires the team password. Any username works; only the password is
// checked.
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const provided = decoded.slice(decoded.indexOf(":") + 1);
      if (provided === password) return NextResponse.next();
    } catch {
      /* malformed header → fall through to 401 */
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Holafly Negotiation Helper"' },
  });
}

export const config = {
  // Gate everything (pages + API + RSC) except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
