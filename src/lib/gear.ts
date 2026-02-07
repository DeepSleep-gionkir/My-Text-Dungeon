export type GearSlot = "weapon" | "armor" | "accessory";

export type GearBonus = Partial<{
  atk: number;
  def: number;
  spd: number;
  luk: number;
  maxHp: number;
  maxMp: number;
}>;

export type GearDef = {
  id: string;
  slot: GearSlot;
  name: string;
  desc: string;
  bonus: GearBonus;
};

export const GEAR_DEFS: Record<string, GearDef> = {
  // ---- Starter-tier (always safe, small bonuses) ----
  ITEM_WEAPON_DULL_SWORD: {
    id: "ITEM_WEAPON_DULL_SWORD",
    slot: "weapon",
    name: "무딘 검",
    desc: "날이 닳아 있어도, 손에 익숙하다.",
    bonus: { atk: 1 },
  },
  ITEM_WEAPON_SIMPLE_DAGGER: {
    id: "ITEM_WEAPON_SIMPLE_DAGGER",
    slot: "weapon",
    name: "단순한 단검",
    desc: "짧지만 빠르다.",
    bonus: { atk: 1, spd: 1 },
  },
  ITEM_WEAPON_WOODEN_STAFF: {
    id: "ITEM_WEAPON_WOODEN_STAFF",
    slot: "weapon",
    name: "나무 지팡이",
    desc: "마력이 담기기 쉬운 재질이다.",
    bonus: { atk: 1, maxMp: 6 },
  },
  ITEM_WEAPON_LIGHT_BOW: {
    id: "ITEM_WEAPON_LIGHT_BOW",
    slot: "weapon",
    name: "가벼운 활",
    desc: "당기는 힘은 약하지만, 조작이 쉽다.",
    bonus: { atk: 1, spd: 1 },
  },
  ITEM_WEAPON_HOLY_MACE: {
    id: "ITEM_WEAPON_HOLY_MACE",
    slot: "weapon",
    name: "성흔 철퇴",
    desc: "금속에 희미한 문양이 새겨져 있다.",
    bonus: { atk: 1, def: 1, maxMp: 2 },
  },
  ITEM_ARMOR_TORN_CLOAK: {
    id: "ITEM_ARMOR_TORN_CLOAK",
    slot: "armor",
    name: "헤진 망토",
    desc: "천이 찢어졌지만, 몸을 가릴 만큼은 된다.",
    bonus: { def: 1, maxHp: 6 },
  },
  ITEM_ACCESSORY_PLAIN_RING: {
    id: "ITEM_ACCESSORY_PLAIN_RING",
    slot: "accessory",
    name: "평범한 반지",
    desc: "특별하진 않지만, 마음을 가라앉힌다.",
    bonus: { luk: 1 },
  },

  ITEM_WEAPON_RUSTY_DAGGER: {
    id: "ITEM_WEAPON_RUSTY_DAGGER",
    slot: "weapon",
    name: "녹슨 단검",
    desc: "가볍지만 날이 무뎌져 있다.",
    bonus: { atk: 2, spd: 1 },
  },
  ITEM_WEAPON_IRON_SWORD: {
    id: "ITEM_WEAPON_IRON_SWORD",
    slot: "weapon",
    name: "철검",
    desc: "표준적인 균형의 검.",
    bonus: { atk: 3 },
  },
  ITEM_WEAPON_CRACKED_WAND: {
    id: "ITEM_WEAPON_CRACKED_WAND",
    slot: "weapon",
    name: "금간 완드",
    desc: "마력이 새지만, 아직 쓸만하다.",
    bonus: { atk: 1, maxMp: 8 },
  },
  ITEM_WEAPON_HUNTER_BOW: {
    id: "ITEM_WEAPON_HUNTER_BOW",
    slot: "weapon",
    name: "사냥꾼의 활",
    desc: "당기는 힘이 강해 손목에 무리가 온다.",
    bonus: { atk: 2, spd: 1 },
  },
  ITEM_WEAPON_STEEL_SWORD: {
    id: "ITEM_WEAPON_STEEL_SWORD",
    slot: "weapon",
    name: "강철검",
    desc: "검신이 단단해 손맛이 확실하다.",
    bonus: { atk: 4 },
  },
  ITEM_WEAPON_SHADOW_DAGGER: {
    id: "ITEM_WEAPON_SHADOW_DAGGER",
    slot: "weapon",
    name: "그림자 단검",
    desc: "빛을 흡수하는 듯한 칼날.",
    bonus: { atk: 3, spd: 2, luk: 1 },
  },
  ITEM_WEAPON_ARCANE_WAND: {
    id: "ITEM_WEAPON_ARCANE_WAND",
    slot: "weapon",
    name: "비전 완드",
    desc: "정제된 마력이 손끝을 타고 흐른다.",
    bonus: { atk: 2, maxMp: 14 },
  },
  ITEM_WEAPON_LONGBOW: {
    id: "ITEM_WEAPON_LONGBOW",
    slot: "weapon",
    name: "장궁",
    desc: "유효 사거리가 길고 관통력이 좋다.",
    bonus: { atk: 3, spd: 2 },
  },
  ITEM_WEAPON_BLESSED_MACE: {
    id: "ITEM_WEAPON_BLESSED_MACE",
    slot: "weapon",
    name: "축성 철퇴",
    desc: "기도의 흔적이 금속에 남아 있다.",
    bonus: { atk: 2, def: 2, maxMp: 6 },
  },

  ITEM_ARMOR_LEATHER_VEST: {
    id: "ITEM_ARMOR_LEATHER_VEST",
    slot: "armor",
    name: "가죽 조끼",
    desc: "움직이기 편한 가벼운 방어구.",
    bonus: { def: 2, maxHp: 10 },
  },
  ITEM_ARMOR_PADDED_ARMOR: {
    id: "ITEM_ARMOR_PADDED_ARMOR",
    slot: "armor",
    name: "누비 갑옷",
    desc: "단단하게 누빈 천이 충격을 흡수한다.",
    bonus: { def: 3, maxHp: 8, spd: -1 },
  },
  ITEM_ARMOR_CHAINMAIL: {
    id: "ITEM_ARMOR_CHAINMAIL",
    slot: "armor",
    name: "사슬 갑옷",
    desc: "무겁지만 확실한 보호를 제공한다.",
    bonus: { def: 4, spd: -1, maxHp: 6 },
  },
  ITEM_ARMOR_BLESSED_ROBE: {
    id: "ITEM_ARMOR_BLESSED_ROBE",
    slot: "armor",
    name: "축복의 로브",
    desc: "몸을 감싸는 천에서 따뜻한 기운이 흐른다.",
    bonus: { def: 1, maxHp: 4, maxMp: 10 },
  },

  ITEM_ACCESSORY_LUCK_CHARM: {
    id: "ITEM_ACCESSORY_LUCK_CHARM",
    slot: "accessory",
    name: "행운 부적",
    desc: "작은 금속 조각이 미세하게 떨린다.",
    bonus: { luk: 2 },
  },
  ITEM_ACCESSORY_THIEF_RING: {
    id: "ITEM_ACCESSORY_THIEF_RING",
    slot: "accessory",
    name: "도둑의 반지",
    desc: "손가락에 끼는 순간, 발걸음이 가벼워진다.",
    bonus: { spd: 1, luk: 1 },
  },
  ITEM_ACCESSORY_HOLY_BEADS: {
    id: "ITEM_ACCESSORY_HOLY_BEADS",
    slot: "accessory",
    name: "성스러운 염주",
    desc: "따뜻한 기운이 손끝에 남는다.",
    bonus: { maxHp: 8, luk: 1 },
  },
  ITEM_ACCESSORY_SCOUT_WHISTLE: {
    id: "ITEM_ACCESSORY_SCOUT_WHISTLE",
    slot: "accessory",
    name: "정찰의 호루라기",
    desc: "숨을 고르면 발걸음이 가벼워진다.",
    bonus: { spd: 1 },
  },
  ITEM_ACCESSORY_FOCUS_TALISMAN: {
    id: "ITEM_ACCESSORY_FOCUS_TALISMAN",
    slot: "accessory",
    name: "집중 부적",
    desc: "정신을 붙잡아준다.",
    bonus: { maxMp: 14 },
  },
};

export function getGearDef(id: string): GearDef | null {
  return GEAR_DEFS[id] ?? null;
}

export function isGearItemId(id: string): boolean {
  return Boolean(GEAR_DEFS[id]);
}

export function gearName(id: string): string {
  return GEAR_DEFS[id]?.name ?? id;
}

export function gearBonusText(bonus: GearBonus): string {
  const parts: string[] = [];
  const push = (label: string, v: number) => {
    if (!v) return;
    parts.push(`${label} ${v > 0 ? "+" : ""}${v}`);
  };
  push("ATK", bonus.atk ?? 0);
  push("DEF", bonus.def ?? 0);
  push("SPD", bonus.spd ?? 0);
  push("LUK", bonus.luk ?? 0);
  push("MaxHP", bonus.maxHp ?? 0);
  push("MaxMP", bonus.maxMp ?? 0);
  return parts.join(" / ");
}

export function estimateGearValue(def: GearDef): number {
  // Coarse heuristic for trader prices; keep it stable and conservative.
  const b = def.bonus;
  const atk = b.atk ?? 0;
  const defv = b.def ?? 0;
  const spd = b.spd ?? 0;
  const luk = b.luk ?? 0;
  const maxHp = b.maxHp ?? 0;
  const maxMp = b.maxMp ?? 0;
  return Math.round(
    atk * 14 +
      defv * 12 +
      spd * 16 +
      luk * 10 +
      maxHp * 0.9 +
      maxMp * 0.9,
  );
}
