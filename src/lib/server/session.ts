import "server-only";

import { cookies } from "next/headers";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";
import type { HeroClass } from "@/types/hero";
import type { MetaPassives, UserProfile, UserResources, UserStats } from "@/types/user";

export const SESSION_COOKIE_NAME = "__session";
export const SESSION_EXPIRES_DAYS = 14;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function sanitizeStats(raw: unknown): UserStats {
  const base: UserStats = { str: 10, dex: 10, int: 10, luck: 10 };
  if (!isRecord(raw)) return base;
  return {
    str: asFiniteNumber(raw.str) ?? base.str,
    dex: asFiniteNumber(raw.dex) ?? base.dex,
    int: asFiniteNumber(raw.int) ?? base.int,
    luck: asFiniteNumber(raw.luck) ?? base.luck,
  };
}

function sanitizeResources(raw: unknown): UserResources {
  const base: UserResources = { gold: 0, essence: 0 };
  if (!isRecord(raw)) return base;
  return {
    gold: asFiniteNumber(raw.gold) ?? base.gold,
    essence: asFiniteNumber(raw.essence) ?? base.essence,
  };
}

function sanitizeUnlocks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").slice(0, 128);
}

function sanitizeHeroClass(raw: unknown): HeroClass | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.toUpperCase();
  const allowed: HeroClass[] = ["WARRIOR", "ROGUE", "MAGE", "RANGER", "CLERIC"];
  return (allowed as readonly string[]).includes(normalized)
    ? (normalized as HeroClass)
    : null;
}

function sanitizeMetaPassives(raw: unknown): MetaPassives {
  const base: MetaPassives = { startHpLv: 0, startMpLv: 0, startPotionLv: 0 };
  if (!isRecord(raw)) return base;
  const startHpLv = asFiniteNumber(raw.start_hp_lv);
  const startMpLv = asFiniteNumber(raw.start_mp_lv);
  const startPotionLv = asFiniteNumber(raw.start_potion_lv);
  const clampLv = (n: number | null, max: number) =>
    n === null ? 0 : Math.max(0, Math.min(max, Math.round(n)));
  return {
    startHpLv: clampLv(startHpLv, 3),
    startMpLv: clampLv(startMpLv, 2),
    startPotionLv: clampLv(startPotionLv, 1),
  };
}

export async function getSessionCookie(): Promise<string | null> {
  // Next 16: cookies() is async.
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function verifySessionCookie(
  sessionCookie: string,
): Promise<{ uid: string } | null> {
  const admin = getFirebaseAdmin();
  if (!admin) return null;
  try {
    const decoded = await admin.auth.verifySessionCookie(sessionCookie, true);
    return decoded?.uid ? { uid: decoded.uid } : null;
  } catch {
    return null;
  }
}

export async function requireUid(): Promise<string> {
  const sessionCookie = await getSessionCookie();
  if (!sessionCookie) throw new Error("NO_SESSION");
  const decoded = await verifySessionCookie(sessionCookie);
  if (!decoded) throw new Error("INVALID_SESSION");
  return decoded.uid;
}

export async function getServerUser(uid: string): Promise<UserProfile | null> {
  const admin = getFirebaseAdmin();
  if (!admin) return null;

  const snap = await admin.db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const raw = snap.data() as Record<string, unknown>;

  const nickname =
    typeof raw.nickname === "string" && raw.nickname.trim() ? raw.nickname.trim() : "모험가";

  const nicknameSet = typeof raw.nickname_set === "boolean" ? raw.nickname_set : true;
  const metaPassives = sanitizeMetaPassives(raw.meta_passives);

  return {
    uid,
    nickname,
    nickname_set: nicknameSet,
    stats: sanitizeStats(raw.stats),
    resources: sanitizeResources(raw.resources),
    unlocks: sanitizeUnlocks(raw.unlocks),
    hero_class: sanitizeHeroClass(raw.hero_class),
    meta_passives: metaPassives,
  };
}
