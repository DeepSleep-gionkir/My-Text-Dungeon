import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { HeroClass } from "@/types/hero";

interface UserStats {
  str: number;
  dex: number;
  int: number;
  luck: number; // Mapping LUK from docs
}

interface UserResources {
  gold: number;
  essence: number;
}

export interface MetaPassives {
  startHpLv: number;
  startMpLv: number;
  startPotionLv: number;
}

interface UserState {
  uid: string | null;
  nickname: string | null;
  needsNickname: boolean;
  stats: UserStats;
  resources: UserResources;
  unlocks: string[];
  heroClass: HeroClass | null;
  metaPassives: MetaPassives;
  isAuthenticated: boolean;
  authReady: boolean;
  geminiApiKey: string | null; // For BYOK

  setUser: (
    uid: string,
    nickname: string,
    stats: UserStats,
    resources: UserResources,
    unlocks: string[],
    heroClass: HeroClass | null,
    metaPassives: MetaPassives,
  ) => void;
  setNickname: (nickname: string) => void;
  setNeedsNickname: (needs: boolean) => void;
  setStats: (stats: UserStats) => void;
  setResources: (resources: UserResources) => void;
  addResources: (delta: Partial<UserResources>) => void;
  setMetaPassives: (metaPassives: MetaPassives) => void;
  setAuthReady: (ready: boolean) => void;
  setGeminiApiKey: (key: string | null) => void;
  setHeroClass: (heroClass: HeroClass) => void;
  logout: () => void;
}

const memoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => {
      store.set(name, value);
    },
    removeItem: (name: string) => {
      store.delete(name);
    },
  };
})();

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      uid: null,
      nickname: null,
      needsNickname: false,
      stats: { str: 10, dex: 10, int: 10, luck: 10 },
      resources: { gold: 0, essence: 0 },
      unlocks: [],
      heroClass: null,
      metaPassives: { startHpLv: 0, startMpLv: 0, startPotionLv: 0 },
      isAuthenticated: false,
      authReady: false,
      geminiApiKey: null,

      setUser: (uid, nickname, stats, resources, unlocks, heroClass, metaPassives) =>
        set({
          uid,
          nickname,
          needsNickname: false,
          stats,
          resources,
          unlocks,
          heroClass,
          metaPassives,
          isAuthenticated: true,
          authReady: true,
        }),

      setNickname: (nickname) => set({ nickname }),

      setNeedsNickname: (needs) => set({ needsNickname: needs }),

      setStats: (stats) => set({ stats }),

      setResources: (resources) => set({ resources }),

      addResources: (delta) =>
        set((state) => ({
          resources: {
            gold:
              typeof delta.gold === "number" && Number.isFinite(delta.gold)
                ? state.resources.gold + delta.gold
                : state.resources.gold,
            essence:
              typeof delta.essence === "number" && Number.isFinite(delta.essence)
                ? state.resources.essence + delta.essence
                : state.resources.essence,
          },
        })),

      setMetaPassives: (metaPassives) => set({ metaPassives }),

      setAuthReady: (ready) => set({ authReady: ready }),

      setGeminiApiKey: (key) => set({ geminiApiKey: key }),

      setHeroClass: (heroClass) => set({ heroClass }),

      logout: () =>
        set((state) => ({
          uid: null,
          nickname: null,
          needsNickname: false,
          stats: { str: 10, dex: 10, int: 10, luck: 10 },
          resources: { gold: 0, essence: 0 },
          unlocks: [],
          heroClass: null,
          metaPassives: { startHpLv: 0, startMpLv: 0, startPotionLv: 0 },
          isAuthenticated: false,
          authReady: true,
          geminiApiKey: state.geminiApiKey,
        })),
    }),
    {
      name: "ai-text-dungeon",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : memoryStorage,
      ),
      partialize: (state) => ({ geminiApiKey: state.geminiApiKey }),
    },
  ),
);
