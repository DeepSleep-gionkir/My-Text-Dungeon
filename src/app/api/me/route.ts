import { NextResponse } from "next/server";
import { getSessionCookie, getServerUser, verifySessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  const sessionCookie = await getSessionCookie();
  if (!sessionCookie) {
    return NextResponse.json({ ok: false, error: "NO_SESSION" }, { status: 401 });
  }

  const decoded = await verifySessionCookie(sessionCookie);
  if (!decoded) {
    return NextResponse.json({ ok: false, error: "INVALID_SESSION" }, { status: 401 });
  }

  const user = await getServerUser(decoded.uid);
  if (!user) {
    return NextResponse.json({ ok: false, error: "NO_USER_DOC" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, user }, { status: 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
