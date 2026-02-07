import "server-only";

import MyDungeonsClient, {
  type MyDungeonListItem,
} from "@/app/(app)/my-dungeons/MyDungeonsClient";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";
import { getServerUser, requireUid } from "@/lib/server/session";
import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Difficulty } from "@/types/builder";
import type { UserProfile } from "@/types/user";

export const dynamic = "force-dynamic";

function asDifficulty(v: unknown): Difficulty {
  const s = typeof v === "string" ? v.toUpperCase() : "";
  if (s === "EASY" || s === "NORMAL" || s === "HARD" || s === "NIGHTMARE") return s;
  return "NORMAL";
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

async function fetchMyDungeons(uid: string): Promise<{
  items: MyDungeonListItem[];
  error: string | null;
}> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return { items: [], error: "서버 설정이 완료되지 않았습니다. (Firebase Admin 환경변수 필요)" };
  }

  try {
    const base = admin.db.collection("dungeons");
    const mapDocs = (docs: QueryDocumentSnapshot<DocumentData>[]) =>
      docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: asString(raw.name, "이름 없음"),
          description: asString(raw.description, ""),
          difficulty: asDifficulty(raw.difficulty),
          room_count: asNumber(raw.room_count, 0),
          likes: asNumber(raw.likes, 0),
          play_count: asNumber(raw.play_count, 0),
        };
      });

    try {
      const snap = await base
        .where("creator_uid", "==", uid)
        .orderBy("created_at", "desc")
        .limit(40)
        .get();
      return { items: mapDocs(snap.docs), error: null };
    } catch {
      // If a composite index is missing, fall back to an unordered query.
      const snap = await base.where("creator_uid", "==", uid).limit(40).get();
      return { items: mapDocs(snap.docs), error: null };
    }
  } catch (e) {
    console.error(e);
    return { items: [], error: "내 던전을 불러오지 못했습니다." };
  }
}

export default async function MyDungeonsPage() {
  const uid = await requireUid();
  const user = (await getServerUser(uid)) as UserProfile | null;

  const fallbackUser: UserProfile = user ?? {
    uid,
    nickname: "모험가",
    nickname_set: true,
    stats: { str: 10, dex: 10, int: 10, luck: 10 },
    resources: { gold: 0, essence: 0 },
    unlocks: [],
    hero_class: null,
    meta_passives: { startHpLv: 0, startMpLv: 0, startPotionLv: 0 },
  };

  const { items, error } = await fetchMyDungeons(uid);

  return (
    <MyDungeonsClient initialUser={fallbackUser} initialItems={items} initialError={error} />
  );
}
