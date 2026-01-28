import type { HeroClass } from "@/types/hero";

export type UserStats = { str: number; dex: number; int: number; luck: number };
export type UserResources = { gold: number; essence: number };
export type MetaPassives = { startHpLv: number; startMpLv: number; startPotionLv: number };

export type UserProfile = {
  uid: string;
  nickname: string;
  nickname_set: boolean;
  stats: UserStats;
  resources: UserResources;
  unlocks: string[];
  hero_class: HeroClass | null;
  meta_passives: MetaPassives;
};

