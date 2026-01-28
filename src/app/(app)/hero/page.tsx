import "server-only";

import HeroClient from "@/app/(app)/hero/HeroClient";
import { getServerUser, requireUid } from "@/lib/server/session";
import type { UserProfile } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function HeroPage() {
  const uid = await requireUid();
  const user = (await getServerUser(uid)) as UserProfile | null;

  const fallback: UserProfile = user ?? {
    uid,
    nickname: "모험가",
    nickname_set: true,
    stats: { str: 10, dex: 10, int: 10, luck: 10 },
    resources: { gold: 0, essence: 0 },
    unlocks: [],
    hero_class: null,
    meta_passives: { startHpLv: 0, startMpLv: 0, startPotionLv: 0 },
  };

  return <HeroClient initialUser={fallback} />;
}

