import type { HeroClass } from "@/types/hero";

export type MetaStats = {
  str: number;
  dex: number;
  int: number;
  luck: number;
};

export type DerivedCombatStats = {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  luk: number;
};

export const HERO_CLASS_LABEL: Record<HeroClass, string> = {
  WARRIOR: "워리어",
  ROGUE: "로그",
  MAGE: "메이지",
  RANGER: "레인저",
  CLERIC: "클레릭",
};

export const HERO_CLASS_ROLE: Record<HeroClass, string> = {
  WARRIOR: "탱커 / 브루저",
  ROGUE: "암살자 / 파밍",
  MAGE: "누커 / 마법",
  RANGER: "원거리 / 탐험",
  CLERIC: "유지력 / 정화",
};

export const HERO_CLASS_TRAIT: Record<HeroClass, string> = {
  WARRIOR: "위기에서 더 단단해집니다.",
  ROGUE: "첫 턴 선공과 함정 대응이 강합니다.",
  MAGE: "정신력이 높고 마법 공격이 강합니다.",
  RANGER: "속도와 안정성이 균형 잡혀 있습니다.",
  CLERIC: "회복과 방어가 안정적입니다.",
};

const clampInt = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(n)));

export function deriveHeroCombatStats(
  meta: Partial<MetaStats> | null | undefined,
  heroClass: HeroClass,
): DerivedCombatStats {
  const m: MetaStats = {
    str: meta?.str ?? 10,
    dex: meta?.dex ?? 10,
    int: meta?.int ?? 10,
    luck: meta?.luck ?? 10,
  };

  let maxHp = 0;
  let maxMp = 0;
  let atk = 0;
  let def = 0;
  let spd = 0;
  let luk = 0;

  switch (heroClass) {
    case "WARRIOR": {
      maxHp = 86 + m.str * 7.2 + m.dex * 1.2;
      maxMp = 14 + m.int * 3.0;
      atk = 7 + m.str * 1.45;
      def = 4 + m.str * 0.25 + m.dex * 0.85;
      spd = 7 + m.dex * 0.75;
      luk = m.luck;
      break;
    }
    case "ROGUE": {
      maxHp = 62 + m.str * 5.0 + m.dex * 1.8;
      maxMp = 18 + m.int * 3.6;
      atk = 6 + m.str * 1.05 + m.dex * 0.45;
      def = 2 + m.dex * 0.65;
      spd = 10 + m.dex * 1.25;
      luk = m.luck + 3;
      break;
    }
    case "MAGE": {
      maxHp = 58 + m.str * 4.6 + m.dex * 1.0;
      maxMp = 34 + m.int * 6.2;
      atk = 5 + m.int * 1.55;
      def = 1 + m.dex * 0.55;
      spd = 8 + m.dex * 0.85;
      luk = m.luck;
      break;
    }
    case "RANGER": {
      maxHp = 70 + m.str * 5.6 + m.dex * 1.7;
      maxMp = 20 + m.int * 4.0;
      atk = 6 + m.str * 1.0 + m.dex * 0.65;
      def = 2 + m.dex * 0.75;
      spd = 9 + m.dex * 1.05;
      luk = m.luck + 1;
      break;
    }
    case "CLERIC": {
      maxHp = 76 + m.str * 5.8 + m.dex * 1.1;
      maxMp = 30 + m.int * 5.2;
      atk = 6 + m.str * 0.85 + m.int * 0.65;
      def = 3 + m.dex * 0.65 + m.str * 0.2;
      spd = 7 + m.dex * 0.75;
      luk = m.luck;
      break;
    }
    default: {
      // Exhaustive guard
      const _exhaustive: never = heroClass;
      return _exhaustive;
    }
  }

  return {
    maxHp: clampInt(maxHp, 1, 9999),
    maxMp: clampInt(maxMp, 0, 9999),
    atk: clampInt(atk, 1, 999),
    def: clampInt(def, 0, 999),
    spd: clampInt(spd, 0, 999),
    luk: clampInt(luk, 0, 999),
  };
}

