import { NextResponse, type NextRequest } from "next/server";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";
import { SESSION_COOKIE_NAME, SESSION_EXPIRES_DAYS } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Firebase Admin 설정이 필요합니다. FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY를 환경변수에 등록하세요.",
      },
      { status: 500 },
    );
  }

  let idToken: string | null = null;
  try {
    const body = (await req.json()) as { idToken?: unknown };
    idToken = typeof body.idToken === "string" ? body.idToken : null;
  } catch {
    idToken = null;
  }

  if (!idToken) {
    return NextResponse.json({ ok: false, error: "idToken이 필요합니다." }, { status: 400 });
  }

  try {
    const expiresInMs = SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
    const sessionCookie = await admin.auth.createSessionCookie(idToken, {
      expiresIn: expiresInMs,
    });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresInMs / 1000),
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "세션 생성에 실패했습니다." },
      { status: 401 },
    );
  }
}

