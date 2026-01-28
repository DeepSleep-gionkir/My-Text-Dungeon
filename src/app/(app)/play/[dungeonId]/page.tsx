import "server-only";

import PlayClient from "@/app/(app)/play/[dungeonId]/PlayClient";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";
import { getServerUser, requireUid } from "@/lib/server/session";
import type { CardData } from "@/types/card";
import type { Difficulty } from "@/types/builder";
import type { UserProfile } from "@/types/user";

export const dynamic = "force-dynamic";

type DungeonDoc = {
  name: string;
  description?: string;
  difficulty: Difficulty;
  room_count: number;
  room_total?: number;
  room_steps?: CardData[][];
  room_steps_v2?: Array<{ rooms: CardData[] }>;
  card_list?: CardData[];
  room_links?: Array<number | [number, number] | null>;
  room_links_v2?: Array<
    | { kind: "END" }
    | { kind: "NEXT"; next: number }
    | { kind: "FORK"; a: number; b: number }
  >;
  creator_nickname?: string;
  likes?: number;
  play_count?: number;
};

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

export default async function PlayPage({
  params,
}: {
  params: Promise<{ dungeonId?: string | string[] }>;
}) {
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

  const resolvedParams = await params;
  const dungeonIdRaw = resolvedParams?.dungeonId;
  const dungeonId =
    typeof dungeonIdRaw === "string"
      ? dungeonIdRaw
      : Array.isArray(dungeonIdRaw)
        ? dungeonIdRaw[0] ?? ""
        : "";
  const admin = getFirebaseAdmin();

  let dungeon: DungeonDoc | null = null;
  let initialError: string | null = null;

  if (!admin) {
    initialError =
      "서버 설정이 완료되지 않아 던전을 불러올 수 없습니다. (Firebase Admin 환경변수 필요)";
  } else if (!dungeonId) {
    initialError = "잘못된 던전 ID입니다.";
  } else {
    try {
      const snap = await admin.db.collection("dungeons").doc(dungeonId).get();
      if (!snap.exists) {
        initialError = "던전을 찾을 수 없습니다.";
      } else {
        const raw = snap.data() as Record<string, unknown>;
        dungeon = {
          name: asString(raw.name, "던전"),
          description: typeof raw.description === "string" ? raw.description : undefined,
          difficulty: asDifficulty(raw.difficulty),
          room_count: asNumber(raw.room_count, 0),
          room_total:
            typeof raw.room_total === "number" && Number.isFinite(raw.room_total)
              ? Math.max(0, Math.round(raw.room_total))
              : undefined,
          room_steps: Array.isArray(raw.room_steps) ? (raw.room_steps as CardData[][]) : undefined,
          room_steps_v2: Array.isArray(raw.room_steps_v2)
            ? (raw.room_steps_v2 as Array<{ rooms: CardData[] }>)
            : undefined,
          card_list: Array.isArray(raw.card_list) ? (raw.card_list as CardData[]) : undefined,
          room_links: Array.isArray(raw.room_links)
            ? (raw.room_links as Array<number | [number, number] | null>)
            : undefined,
          room_links_v2: Array.isArray(raw.room_links_v2)
            ? (raw.room_links_v2 as DungeonDoc["room_links_v2"])
            : undefined,
          creator_nickname:
            typeof raw.creator_nickname === "string" ? raw.creator_nickname : undefined,
          likes:
            typeof raw.likes === "number" && Number.isFinite(raw.likes) ? raw.likes : undefined,
          play_count:
            typeof raw.play_count === "number" && Number.isFinite(raw.play_count)
              ? raw.play_count
              : undefined,
        };
      }
    } catch (e) {
      console.error(e);
      initialError = "던전을 불러오지 못했습니다.";
    }
  }

  return (
    <PlayClient
      dungeonId={dungeonId}
      initialDungeon={dungeon}
      initialUser={fallbackUser}
      initialError={initialError}
    />
  );
}
