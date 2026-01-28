"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { type MetaPassives, useUserStore } from "@/store/useUserStore";
import type { HeroClass } from "@/types/hero";

type FirestoreUserDoc = {
  uid: string;
  nickname: string;
  nickname_set?: boolean;
  email?: string | null;
  stats: { str: number; dex: number; int: number; luck: number };
  resources: { gold: number; essence: number };
  unlocks: string[];
  hero_class?: HeroClass | null;
  meta_passives?: { start_hp_lv?: number; start_mp_lv?: number; start_potion_lv?: number };
  createdAt?: string;
};

const DEFAULT_STATS: FirestoreUserDoc["stats"] = {
  str: 10,
  dex: 10,
  int: 10,
  luck: 10,
};

const DEFAULT_RESOURCES: FirestoreUserDoc["resources"] = {
  gold: 0,
  essence: 0,
};

const DEFAULT_META_PASSIVES: MetaPassives = {
  startHpLv: 0,
  startMpLv: 0,
  startPotionLv: 0,
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const asFiniteNumber = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function sanitizeStats(raw: unknown): FirestoreUserDoc["stats"] {
  if (!isRecord(raw)) return { ...DEFAULT_STATS };
  const str = asFiniteNumber(raw.str);
  const dex = asFiniteNumber(raw.dex);
  const int = asFiniteNumber(raw.int);
  const luck = asFiniteNumber(raw.luck);
  return {
    str: str ?? DEFAULT_STATS.str,
    dex: dex ?? DEFAULT_STATS.dex,
    int: int ?? DEFAULT_STATS.int,
    luck: luck ?? DEFAULT_STATS.luck,
  };
}

function sanitizeResources(raw: unknown): FirestoreUserDoc["resources"] {
  if (!isRecord(raw)) return { ...DEFAULT_RESOURCES };
  const gold = asFiniteNumber(raw.gold);
  const essence = asFiniteNumber(raw.essence);
  return {
    gold: gold ?? DEFAULT_RESOURCES.gold,
    essence: essence ?? DEFAULT_RESOURCES.essence,
  };
}

function sanitizeUnlocks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").slice(0, 64);
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
  if (!isRecord(raw)) return { ...DEFAULT_META_PASSIVES };
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

export default function AuthListener() {
  const setUser = useUserStore((s) => s.setUser);
  const logout = useUserStore((s) => s.logout);
  const setAuthReady = useUserStore((s) => s.setAuthReady);
  const setNeedsNickname = useUserStore((s) => s.setNeedsNickname);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          fetch("/api/logout", { method: "POST" }).catch(() => {});
          logout();
          return;
        }

        // Best-effort: keep the server session cookie in sync with Firebase Auth.
        fbUser
          .getIdToken()
          .then((idToken) =>
            fetch("/api/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken }),
            }).catch(() => {}),
          )
          .catch(() => {});

        const userRef = doc(db, "users", fbUser.uid);
        const userSnap = await getDoc(userRef);

        let userData: FirestoreUserDoc;
        let nicknameSet = true;
        let metaPassives: MetaPassives = { ...DEFAULT_META_PASSIVES };
        if (userSnap.exists()) {
          const raw = userSnap.data() as Record<string, unknown>;
          nicknameSet = typeof raw.nickname_set === "boolean" ? raw.nickname_set : true;
          userData = {
            uid: fbUser.uid,
            nickname:
              typeof raw.nickname === "string" && raw.nickname.trim()
                ? raw.nickname.trim()
                : fbUser.displayName || "모험가",
            nickname_set: nicknameSet,
            email: typeof raw.email === "string" ? raw.email : fbUser.email,
            stats: sanitizeStats(raw.stats),
            resources: sanitizeResources(raw.resources),
            unlocks: sanitizeUnlocks(raw.unlocks),
            hero_class: sanitizeHeroClass(raw.hero_class),
            meta_passives: isRecord(raw.meta_passives)
              ? (raw.meta_passives as FirestoreUserDoc["meta_passives"])
              : undefined,
            createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
          };
          metaPassives = sanitizeMetaPassives(raw.meta_passives);

          // Best-effort backfill for legacy docs with missing fields.
          setDoc(
            userRef,
            {
              nickname: userData.nickname,
              nickname_set: nicknameSet,
              email: userData.email ?? null,
              stats: userData.stats,
              resources: userData.resources,
              unlocks: userData.unlocks,
              hero_class: userData.hero_class ?? null,
              meta_passives: {
                start_hp_lv: metaPassives.startHpLv,
                start_mp_lv: metaPassives.startMpLv,
                start_potion_lv: metaPassives.startPotionLv,
              },
            },
            { merge: true },
          ).catch(() => {});
        } else {
          nicknameSet = false;
          userData = {
            uid: fbUser.uid,
            nickname: fbUser.displayName || "모험가",
            nickname_set: false,
            email: fbUser.email,
            stats: { ...DEFAULT_STATS },
            resources: { ...DEFAULT_RESOURCES },
            unlocks: ["CLASS_WARRIOR"],
            hero_class: null,
            meta_passives: { start_hp_lv: 0, start_mp_lv: 0, start_potion_lv: 0 },
            createdAt: new Date().toISOString(),
          };
          await setDoc(userRef, userData);
          metaPassives = { ...DEFAULT_META_PASSIVES };
        }

        setUser(
          userData.uid,
          userData.nickname,
          userData.stats,
          userData.resources,
          userData.unlocks,
          userData.hero_class ?? null,
          metaPassives,
        );
        setNeedsNickname(!nicknameSet);
      } catch (e) {
        // On a fatal auth sync error, fall back to logged-out state.
        console.error(e);
        logout();
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, [logout, setAuthReady, setNeedsNickname, setUser]);

  return null;
}
