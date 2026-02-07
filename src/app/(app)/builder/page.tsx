import "server-only";

import BuilderClient from "@/app/(app)/builder/BuilderClient";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";
import { getServerUser, requireUid } from "@/lib/server/session";
import type { CardData } from "@/types/card";
import type { UserProfile } from "@/types/user";

export const dynamic = "force-dynamic";

type StoredCard = CardData & { _docId: string };

export default async function BuilderPage() {
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

  const admin = getFirebaseAdmin();
  let initialDeck: StoredCard[] = [];
  if (admin) {
    try {
      const snap = await admin.db
        .collection("users")
        .doc(uid)
        .collection("cards")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      initialDeck = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        const sanitized = { ...(raw as Record<string, unknown>) };
        delete sanitized.createdAt;
        return { ...(sanitized as unknown as CardData), _docId: d.id };
      });
    } catch (e) {
      console.error(e);
      initialDeck = [];
    }
  }

  return <BuilderClient initialUser={fallback} initialDeck={initialDeck} />;
}
