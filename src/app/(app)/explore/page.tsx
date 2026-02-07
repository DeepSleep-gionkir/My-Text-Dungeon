import "server-only";

import ExploreClient, { type DungeonListItem } from "@/app/(app)/explore/ExploreClient";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";
import { requireUid } from "@/lib/server/session";
import type { Difficulty } from "@/types/builder";

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

export default async function ExplorePage() {
  await requireUid();
  const admin = getFirebaseAdmin();
  if (!admin) {
    return (
      <ExploreClient
        initialItems={[]}
        initialError={
          "서버 설정이 완료되지 않아 던전 목록을 불러올 수 없습니다. (Firebase Admin 환경변수 필요)"
        }
      />
    );
  }

  let items: DungeonListItem[] = [];
  let initialError: string | null = null;

  try {
    const snap = await admin.db
      .collection("dungeons")
      .orderBy("created_at", "desc")
      .limit(30)
      .get();

    items = snap.docs.map((doc) => {
      const raw = doc.data() as Record<string, unknown>;
      const creatorNickname =
        typeof raw.creator_nickname === "string" ? raw.creator_nickname : undefined;
      return {
        id: doc.id,
        name: asString(raw.name, "이름 없음"),
        description: asString(raw.description, ""),
        difficulty: asDifficulty(raw.difficulty),
        room_count: asNumber(raw.room_count, 0),
        creator_uid: asString(raw.creator_uid, ""),
        creator_nickname: creatorNickname,
        likes: asNumber(raw.likes, 0),
        play_count: asNumber(raw.play_count, 0),
      };
    });
  } catch (e) {
    console.error(e);
    items = [];
    initialError = "던전 목록을 불러오지 못했습니다.";
  }

  return <ExploreClient initialItems={items} initialError={initialError} />;
}
