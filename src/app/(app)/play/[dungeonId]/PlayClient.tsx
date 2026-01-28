"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CardAction, CardData } from "@/types/card";
import type { Difficulty } from "@/types/builder";
import type { HeroClass } from "@/types/hero";
import type { UserProfile } from "@/types/user";
import CardView from "@/components/card/CardView";
import AppLogoLink from "@/components/app/AppLogoLink";
import { type MetaPassives, useUserStore } from "@/store/useUserStore";
import { deriveHeroCombatStats } from "@/lib/hero";
import { generateGeminiJSON } from "@/lib/gemini";
import KeywordIcon from "@/components/keyword/KeywordIcon";
import {
  FaArrowRight,
  FaBolt,
  FaChevronLeft,
  FaHandPaper,
  FaHeart,
  FaPlay,
  FaShieldAlt,
  FaSkull,
  FaShoePrints,
  FaTrophy,
  FaUserShield,
} from "react-icons/fa";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ShrineCostIcon, ShrineRewardIcon } from "@/components/shrine/ShrineOptionIcons";

type DungeonDoc = {
  name: string;
  description?: string;
  difficulty: Difficulty;
  // NOTE: For newer dungeons, room_count means "progress steps" (갈림길은 슬롯만 추가).
  // For legacy dungeons, room_count may equal total rooms.
  room_count: number;
  room_total?: number;
  room_steps?: CardData[][]; // legacy (Firestore does not support nested arrays)
  room_steps_v2?: Array<{ rooms: CardData[] }>;
  card_list?: CardData[];
  room_links?: RoomLink[];
  room_links_v2?: Array<
    | { kind: "END" }
    | { kind: "NEXT"; next: number }
    | { kind: "FORK"; a: number; b: number }
  >;
  creator_nickname?: string;
};

type HeroState = {
  level: number;
  xp: number;
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  luk: number;
  gold: number;
  starterGold: number;
  goldDebt: number;
  items: Record<string, number>;
  effects: EffectInstance[];
};

type EnemyState = {
  name: string;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  tags: string[];
  actions?: CardAction[];
  effects: EffectInstance[];
};

type EncounterPhase =
  | "LOADING"
  | "ENTRY"
  | "FORK"
  | "ENCOUNTER"
  | "COMBAT"
  | "LEVEL_UP"
  | "RESOLVED"
  | "CLEAR"
  | "DEAD";

type RoomLink = number | [number, number] | null;

type EffectInstance = {
  id: string; // e.g., STATUS_BURN, BUFF_REGEN
  stacks: number;
  turns: number; // remaining turns on the affected unit
  data?: Record<string, unknown>;
};

const SHRINE_GUARDIAN_STATS: Record<Difficulty, { hp: number; atk: number; def: number; spd: number }> =
  {
    EASY: { hp: 90, atk: 10, def: 3, spd: 11 },
    NORMAL: { hp: 130, atk: 16, def: 5, spd: 12 },
    HARD: { hp: 180, atk: 24, def: 7, spd: 13 },
    NIGHTMARE: { hp: 260, atk: 34, def: 10, spd: 14 },
  };

const TRAP_TRIGGER_RATE: Record<Difficulty, number> = {
  EASY: 0.3,
  NORMAL: 0.5,
  HARD: 0.7,
  NIGHTMARE: 0.9,
};

const START_GOLD_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 120,
  NORMAL: 160,
  HARD: 220,
  NIGHTMARE: 300,
};

const DEFAULT_EFFECT_TURNS = 2;

const EFFECT_LABEL: Record<string, string> = {
  STATUS_BURN: "화상",
  STATUS_HEAVY_BURN: "중화상",
  STATUS_POISON: "중독",
  STATUS_TOXIC: "맹독",
  STATUS_BLEED: "출혈",
  STATUS_STUN: "기절",
  STATUS_FREEZE: "빙결",
  STATUS_CHILL: "오한",
  STATUS_SHOCK: "감전",
  STATUS_BLIND: "실명",
  STATUS_CONFUSION: "혼란",
  STATUS_WEAK: "약화",
  STATUS_VULNERABLE: "취약",
  STATUS_SILENCE: "침묵",
  STATUS_FEAR: "공포",
  STATUS_CURSE: "저주",
  BUFF_REGEN: "재생",
  BUFF_MIGHT: "괴력",
  BUFF_IRON_SKIN: "철갑",
  BUFF_REFLECT: "반사",
  BUFF_EVASION: "회피",
  BUFF_VAMPIRISM: "흡혈",
  BUFF_BERSERK: "광폭화",
  BUFF_STEALTH: "은신",
};

const ATTR_INFLICTS_STATUS: Array<{
  attr: string;
  status: string;
  chance: number;
}> = [
  { attr: "ATTR_FIRE", status: "STATUS_BURN", chance: 0.4 },
  { attr: "ATTR_ICE", status: "STATUS_CHILL", chance: 0.35 },
  { attr: "ATTR_LIGHTNING", status: "STATUS_SHOCK", chance: 0.35 },
  { attr: "ATTR_POISON", status: "STATUS_POISON", chance: 0.4 },
  { attr: "ATTR_DARK", status: "STATUS_CURSE", chance: 0.25 },
  { attr: "ATTR_SOUND", status: "STATUS_STUN", chance: 0.2 },
];

function effectLabel(id: string) {
  const key = id.trim().toUpperCase();
  return EFFECT_LABEL[key] ?? "효과";
}

function upsertEffect(
  effects: EffectInstance[],
  id: string,
  opts?: { stacks?: number; turns?: number; data?: Record<string, unknown> },
): EffectInstance[] {
  const key = id.trim().toUpperCase();
  const stacks = Math.max(1, Math.round(opts?.stacks ?? 1));
  const turns = Math.max(1, Math.round(opts?.turns ?? DEFAULT_EFFECT_TURNS));
  const next: EffectInstance = {
    id: key,
    stacks,
    turns,
    data: opts?.data,
  };

  const idx = effects.findIndex((e) => e.id === key);
  if (idx === -1) return [...effects, next];

  const cur = effects[idx]!;
  const merged: EffectInstance = {
    id: key,
    stacks: Math.min(99, cur.stacks + stacks),
    turns: Math.max(cur.turns, turns),
    data: cur.data ?? next.data,
  };
  const out = effects.slice();
  out[idx] = merged;
  return out;
}

function tickDownEffects(effects: EffectInstance[], by = 1): EffectInstance[] {
  const dec = Math.max(0, Math.round(by));
  if (dec === 0) return effects;
  return effects
    .map((e) => ({ ...e, turns: e.turns - dec }))
    .filter((e) => e.turns > 0)
    .slice(0, 16);
}

function hasEffect(effects: EffectInstance[], id: string) {
  const key = id.trim().toUpperCase();
  return effects.some((e) => e.id === key && e.turns > 0);
}

function calcEndOfTurnDot(maxHp: number, effects: EffectInstance[]) {
  const find = (id: string) => effects.find((e) => e.id === id && e.turns > 0);
  const burn = find("STATUS_BURN") ?? find("STATUS_HEAVY_BURN");
  const poison = find("STATUS_POISON") ?? find("STATUS_TOXIC");
  const bleed = find("STATUS_BLEED");

  const lines: string[] = [];
  let dmg = 0;

  if (burn) {
    const per = burn.id === "STATUS_HEAVY_BURN" ? 8 : 5;
    const d = per * Math.max(1, burn.stacks);
    dmg += d;
    lines.push(`${effectLabel(burn.id)} 피해: -${d} HP`);
  }
  if (poison) {
    const base = Math.max(1, Math.round(maxHp * 0.05));
    const d = base * Math.max(1, poison.stacks);
    dmg += d;
    lines.push(`${effectLabel(poison.id)} 피해: -${d} HP`);
  }
  if (bleed) {
    const d = 6 * Math.max(1, bleed.stacks);
    dmg += d;
    lines.push(`${effectLabel(bleed.id)} 피해: -${d} HP`);
  }

  return { dmg, lines };
}

function calcStartOfTurnHot(maxHp: number, hp: number, effects: EffectInstance[]) {
  const regen = effects.find((e) => e.id === "BUFF_REGEN" && e.turns > 0);
  if (!regen) return { heal: 0, lines: [] as string[] };
  const base = Math.max(1, Math.round(maxHp * 0.06));
  const heal = Math.max(0, Math.min(maxHp - hp, base * Math.max(1, regen.stacks)));
  if (heal <= 0) return { heal: 0, lines: [] as string[] };
  return { heal, lines: [`${effectLabel(regen.id)}: +${heal} HP`] };
}

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const defaultLinksFor = (n: number): RoomLink[] =>
  Array.from({ length: n }, (_, i) => (i + 1 < n ? i + 1 : null));

const normalizeRoomLinks = (raw: unknown, n: number): RoomLink[] => {
  const base = defaultLinksFor(n);
  if (!Array.isArray(raw)) return base;
  const out: RoomLink[] = base.slice();
  const len = Math.min(n, raw.length);
  for (let i = 0; i < len; i++) {
    const v = raw[i];
    if (v === null) {
      out[i] = null;
      continue;
    }
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < n) {
      out[i] = v;
      continue;
    }
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === "number" &&
      typeof v[1] === "number" &&
      Number.isInteger(v[0]) &&
      Number.isInteger(v[1]) &&
      v[0] >= 0 &&
      v[1] >= 0 &&
      v[0] < n &&
      v[1] < n &&
      v[0] !== v[1]
    ) {
      out[i] = [v[0], v[1]];
    }
  }
  return out;
};

const normalizeRoomLinksV2 = (raw: unknown, n: number): RoomLink[] => {
  const base = defaultLinksFor(n);
  if (!Array.isArray(raw)) return base;
  const out: RoomLink[] = base.slice();
  const len = Math.min(n, raw.length);
  for (let i = 0; i < len; i++) {
    const v = raw[i];
    if (!v || typeof v !== "object") continue;
    const obj = v as Record<string, unknown>;

    const kind = typeof obj.kind === "string" ? obj.kind : "";
    if (kind === "END") {
      out[i] = null;
      continue;
    }
    if (kind === "NEXT") {
      const next = obj.next;
      if (typeof next === "number" && Number.isInteger(next) && next >= 0 && next < n) {
        out[i] = next;
      }
      continue;
    }
    if (kind === "FORK") {
      const a = obj.a;
      const b = obj.b;
      if (
        typeof a === "number" &&
        typeof b === "number" &&
        Number.isInteger(a) &&
        Number.isInteger(b) &&
        a >= 0 &&
        b >= 0 &&
        a < n &&
        b < n &&
        a !== b
      ) {
        out[i] = [a, b];
      }
      continue;
    }

    // tolerant fallback shapes (if schema changes)
    const next = obj.next;
    if (next === null) {
      out[i] = null;
      continue;
    }
    if (typeof next === "number" && Number.isInteger(next) && next >= 0 && next < n) {
      out[i] = next;
      continue;
    }
    const fork = obj.fork;
    if (fork && typeof fork === "object") {
      const f = fork as Record<string, unknown>;
      const a2 = f.a;
      const b2 = f.b;
      if (
        typeof a2 === "number" &&
        typeof b2 === "number" &&
        Number.isInteger(a2) &&
        Number.isInteger(b2) &&
        a2 >= 0 &&
        b2 >= 0 &&
        a2 < n &&
        b2 < n &&
        a2 !== b2
      ) {
        out[i] = [a2, b2];
      }
    }
  }
  return out;
};

function normalizeDungeonDoc(raw: DungeonDoc): {
  dungeon: DungeonDoc;
  roomToStep: number[] | null;
  firstStepFork: boolean;
} {
  const rawStepsV2 = Array.isArray(raw.room_steps_v2) ? raw.room_steps_v2 : null;
  const rawStepsLegacy = Array.isArray(raw.room_steps) ? raw.room_steps : null;

  // Normalize card_list (legacy docs may not have room_steps; some docs may omit card_list).
  const cardsFromSteps: CardData[] = [];
  const indicesByStep: number[][] = [];
  const stepMap: number[] = [];
  let idx = 0;

  if (rawStepsV2) {
    for (let si = 0; si < rawStepsV2.length; si++) {
      const stepDoc = rawStepsV2[si];
      if (!stepDoc || typeof stepDoc !== "object") continue;
      const roomsRaw = (stepDoc as { rooms?: unknown }).rooms;
      const rooms = Array.isArray(roomsRaw) ? roomsRaw.slice(0, 2) : [];
      const cards: CardData[] = [];
      for (const c of rooms) {
        if (c && typeof c === "object") cards.push(c as CardData);
      }
      const count = cards.length >= 2 ? 2 : 1;
      if (count === 1) {
        indicesByStep.push([idx]);
        stepMap.push(si);
        if (cards[0]) cardsFromSteps.push(cards[0]);
        idx += 1;
      } else {
        indicesByStep.push([idx, idx + 1]);
        stepMap.push(si, si);
        if (cards[0]) cardsFromSteps.push(cards[0]);
        if (cards[1]) cardsFromSteps.push(cards[1]);
        idx += 2;
      }
    }
  } else if (rawStepsLegacy) {
    for (let si = 0; si < rawStepsLegacy.length; si++) {
      const step = rawStepsLegacy[si];
      if (!Array.isArray(step)) continue;
      const count = step.length >= 2 ? 2 : 1;
      if (count === 1) {
        indicesByStep.push([idx]);
        stepMap.push(si);
        const c = step[0];
        if (c && typeof c === "object") cardsFromSteps.push(c as CardData);
        idx += 1;
      } else {
        indicesByStep.push([idx, idx + 1]);
        stepMap.push(si, si);
        const c0 = step[0];
        const c1 = step[1];
        if (c0 && typeof c0 === "object") cardsFromSteps.push(c0 as CardData);
        if (c1 && typeof c1 === "object") cardsFromSteps.push(c1 as CardData);
        idx += 2;
      }
    }
  }

  const card_list: CardData[] = Array.isArray(raw.card_list) ? raw.card_list : cardsFromSteps;

  // room_total is authoritative for bounds; fall back to card_list length.
  const room_total =
    typeof raw.room_total === "number" && Number.isFinite(raw.room_total)
      ? Math.max(0, Math.round(raw.room_total))
      : card_list.length;

  // Normalize room_links:
  // - v2 uses a Firestore-safe object shape
  // - legacy uses numbers and tuples
  // - if missing, derive deterministic links from steps when possible
  let room_links: RoomLink[] | undefined = undefined;
  if (Array.isArray(raw.room_links_v2)) {
    room_links = normalizeRoomLinksV2(raw.room_links_v2, room_total);
  } else if (Array.isArray(raw.room_links)) {
    room_links = normalizeRoomLinks(raw.room_links, room_total);
  } else if (indicesByStep.length && room_total) {
    room_links = Array.from({ length: room_total }, () => null);
    for (let si = 0; si < indicesByStep.length; si++) {
      const next =
        si + 1 >= indicesByStep.length
          ? null
          : indicesByStep[si + 1]!.length === 1
            ? indicesByStep[si + 1]![0]!
            : ([indicesByStep[si + 1]![0]!, indicesByStep[si + 1]![1]!] as [
                number,
                number,
              ]);
      for (const ri of indicesByStep[si]!) {
        if (ri >= 0 && ri < room_total) room_links[ri] = next;
      }
    }
  }

  // Build a mapping for progress label (roomIndex -> stepIndex) when steps are available.
  const roomToStep: number[] | null = stepMap.length === card_list.length ? stepMap : null;

  const firstStepFork = (() => {
    if (rawStepsV2 && rawStepsV2[0] && typeof rawStepsV2[0] === "object") {
      const rooms0 = (rawStepsV2[0] as { rooms?: unknown }).rooms;
      if (Array.isArray(rooms0) && rooms0.length >= 2) return true;
    }
    if (rawStepsLegacy && Array.isArray(rawStepsLegacy[0]) && rawStepsLegacy[0].length >= 2)
      return true;
    return false;
  })();

  return {
    dungeon: {
      ...raw,
      card_list,
      room_links,
      room_total,
    },
    roomToStep,
    firstStepFork,
  };
}

function buildHero(
  meta: { str: number; dex: number; int: number; luck: number },
  heroClass: HeroClass,
  passives?: MetaPassives | null,
  starterGold = 0,
): HeroState {
  const derived = deriveHeroCombatStats(meta, heroClass);
  const hpLv = Math.max(0, Math.min(3, Math.round(passives?.startHpLv ?? 0)));
  const mpLv = Math.max(0, Math.min(2, Math.round(passives?.startMpLv ?? 0)));
  const potLv = Math.max(0, Math.min(1, Math.round(passives?.startPotionLv ?? 0)));
  const startHpBonus = hpLv * 5;
  const startMpBonus = mpLv * 5;
  return {
    level: 1,
    xp: 0,
    maxHp: derived.maxHp + startHpBonus,
    hp: derived.maxHp + startHpBonus,
    maxMp: derived.maxMp + startMpBonus,
    mp: derived.maxMp + startMpBonus,
    atk: derived.atk,
    def: derived.def,
    spd: derived.spd,
    luk: derived.luk,
    gold: Math.max(0, Math.round(starterGold)),
    starterGold: Math.max(0, Math.round(starterGold)),
    goldDebt: 0,
    items: { ITEM_POTION_S: 1 + potLv },
    effects: [],
  };
}

function isCombatCard(category: string) {
  return category.includes("ENEMY") || category.includes("BOSS");
}

function calcDamage(atk: number, def: number, mul = 1, reduction = 1) {
  const raw = atk * mul - def * 0.5;
  const dmg = Math.max(1, Math.round(raw));
  return Math.max(0, Math.round(dmg * reduction));
}

function calcCritChance(luk: number) {
  // Base 5%, scales gently with LUK.
  return clamp(0.05 + (luk - 10) * 0.005, 0.05, 0.25);
}

function attrSuffix(attr: string) {
  return attr.replace(/^ATTR_/, "");
}

function damageFactorFor(
  attackAttr: string | null | undefined,
  defenderTags: string[] | null | undefined,
): { factor: number; note?: string } {
  if (!attackAttr) return { factor: 1 };
  const tags = Array.isArray(defenderTags) ? defenderTags : [];
  const s = attrSuffix(attackAttr);
  if (tags.includes(`IMMUNE_${s}`)) return { factor: 0, note: "면역" };
  if (tags.includes(`WEAK_${s}`)) return { factor: 1.7, note: "약점" };
  if (tags.includes(`RESIST_${s}`)) return { factor: 0.5, note: "저항" };

  // Small built-in interactions from the docs.
  if (attackAttr === "ATTR_HOLY" && tags.includes("TAG_UNDEAD"))
    return { factor: 1.5, note: "특효" };
  if (attackAttr === "ATTR_LIGHTNING" && tags.includes("TAG_CONSTRUCT"))
    return { factor: 1.5, note: "특효" };

  return { factor: 1 };
}

const HERO_BASE_ATTR: Record<HeroClass, string> = {
  WARRIOR: "ATTR_PHYSICAL_SLASH",
  ROGUE: "ATTR_PHYSICAL_PIERCE",
  MAGE: "ATTR_MENTAL",
  RANGER: "ATTR_PHYSICAL_PIERCE",
  CLERIC: "ATTR_HOLY",
};

type LevelUpChoiceId = "HP" | "MP" | "ATK" | "DEF" | "SPD" | "LUK" | "POTION";

const LEVEL_UP_POOL: Array<{ id: LevelUpChoiceId; label: string }> = [
  { id: "HP", label: "최대 HP +10" },
  { id: "MP", label: "최대 MP +8" },
  { id: "ATK", label: "공격력 +2" },
  { id: "DEF", label: "방어력 +2" },
  { id: "SPD", label: "속도 +1" },
  { id: "LUK", label: "행운 +1" },
  { id: "POTION", label: "포션 +1" },
];

function xpToNext(level: number) {
  // Gentle curve: a single dungeon shouldn't snowball too hard.
  const lv = Math.max(1, Math.round(level));
  return 60 + (lv - 1) * 30;
}

function rollLevelUpChoices(): Array<{ id: LevelUpChoiceId; label: string }> {
  const pool = LEVEL_UP_POOL.slice();
  const out: Array<{ id: LevelUpChoiceId; label: string }> = [];
  while (out.length < 3 && pool.length > 0) {
    const idx = randInt(0, pool.length - 1);
    const picked = pool.splice(idx, 1)[0];
    if (picked) out.push(picked);
  }
  return out;
}

function applyLevelUpChoice(hero: HeroState, id: LevelUpChoiceId): HeroState {
  switch (id) {
    case "HP": {
      const maxHp = hero.maxHp + 10;
      return { ...hero, maxHp, hp: Math.min(maxHp, hero.hp + 10) };
    }
    case "MP": {
      const maxMp = hero.maxMp + 8;
      return { ...hero, maxMp, mp: Math.min(maxMp, hero.mp + 8) };
    }
    case "ATK":
      return { ...hero, atk: hero.atk + 2 };
    case "DEF":
      return { ...hero, def: hero.def + 2 };
    case "SPD":
      return { ...hero, spd: hero.spd + 1 };
    case "LUK":
      return { ...hero, luk: hero.luk + 1 };
    case "POTION": {
      const nextItems = { ...hero.items };
      nextItems.ITEM_POTION_S = (nextItems.ITEM_POTION_S ?? 0) + 1;
      return { ...hero, items: nextItems };
    }
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

function pickEnemyAction(actions?: CardAction[], hpRatio?: number): CardAction | null {
  if (!actions || actions.length === 0) return null;

  if (hpRatio !== undefined && hpRatio <= 0.5) {
    const phase = actions.find((a) => a.trigger === "HP_BELOW_50");
    if (phase) return phase;
  }

  const pool = actions.filter(
    (a) => a.trigger === "ON_TURN" || a.trigger === "ON_TURN_START" || a.trigger === "PASSIVE",
  );
  if (pool.length === 0) return actions[0];
  return pool[randInt(0, pool.length - 1)];
}

function goldFromReward(rewards: CardData["rewards"]): number {
  if (!rewards?.gold) return 0;
  if (typeof rewards.gold === "number") return Math.max(0, Math.round(rewards.gold));
  const min = Math.round(rewards.gold.min);
  const max = Math.round(rewards.gold.max);
  return randInt(Math.min(min, max), Math.max(min, max));
}

function itemsFromReward(rewards: CardData["rewards"]): string[] {
  if (!rewards?.items) return [];
  if (!Array.isArray(rewards.items)) return [];
  const out: string[] = [];
  for (const raw of rewards.items) {
    if (typeof raw === "string") out.push(raw);
    else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : null;
      if (!id) continue;
      const rate =
        typeof obj.rate === "number" && Number.isFinite(obj.rate) ? obj.rate : 1;
      if (Math.random() <= clamp(rate, 0, 1)) out.push(id);
    }
  }
  return out;
}

function xpFromCard(card: CardData, difficulty: Difficulty): number {
  const explicit = card.rewards?.xp;
  if (typeof explicit === "number" && Number.isFinite(explicit))
    return Math.max(0, Math.round(explicit));

  if (!isCombatCard(card.category)) return 0;

  const base =
    difficulty === "EASY"
      ? 16
      : difficulty === "HARD"
        ? 28
        : difficulty === "NIGHTMARE"
          ? 40
          : 22;

  const grade = card.grade ?? "NORMAL";
  const gradeMul =
    grade === "BOSS"
      ? 3
      : grade === "LEGENDARY"
        ? 2.3
        : grade === "EPIC"
          ? 1.9
          : grade === "ELITE"
            ? 1.6
            : 1;

  return Math.max(0, Math.round(base * gradeMul));
}

function shrineRewardLabel(type: string, value: unknown): string {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
  switch (type) {
    case "STAT_ATK_UP":
      return `공격력 +${n ?? 0}`;
    case "STAT_DEF_UP":
      return `방어력 +${n ?? 0}`;
    case "STAT_SPD_UP":
      return `속도 +${n ?? 0}`;
    case "STAT_MAXHP_PCT_UP":
      return `최대 HP +${n ?? 0}%`;
    case "HEAL_FULL":
      return "완전 회복";
    case "CLEANSE":
      return "정화";
    case "GAIN_GOLD":
      return `골드 +${n ?? 0}`;
    case "GAIN_ITEM":
      return typeof value === "string" ? `아이템 획득: ${value}` : "아이템 획득";
    case "GAIN_RELIC_SHARD":
      return "유물 조각 획득";
    case "RESET_COOLDOWN":
      return "쿨타임 초기화";
    case "RESURRECT_TOKEN":
      return "부활 토큰 획득";
    case "ALL_STATS_UP":
      return `전투 스탯 +${n ?? 1}`;
    default:
      return type;
  }
}

function shrineCostLabel(type: string, value: unknown): string {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
  switch (type) {
    case "HP_FLAT":
      return `HP -${n ?? 0}`;
    case "MAXHP_PCT_DOWN":
      return `최대 HP -${n ?? 0}%`;
    case "DEF_DOWN":
      return `방어력 -${n ?? 0}`;
    case "MP_FLAT":
      return `MP -${n ?? 0}`;
    case "GOLD_FLAT":
      return `골드 -${n ?? 0}`;
    case "ADD_DEBUFF_BLEED":
      return "저주: 출혈";
    case "ADD_DEBUFF_BLIND":
      return "저주: 실명";
    case "ADD_DEBUFF_WEAK":
      return "저주: 약화";
    case "SUMMON_ENEMY":
      return "대가: 적 소환";
    case "DESTROY_ITEM":
      return "대가: 아이템 파괴";
    case "TIME_PENALTY":
      return n !== null ? `대가: 시간 손실 (던전 골드 -${n}G)` : "대가: 시간 손실";
    case "NO_COST":
      return "대가 없음";
    default:
      return type;
  }
}

export default function PlayClient({
  dungeonId,
  initialDungeon,
  initialUser,
  initialError = null,
}: {
  dungeonId: string;
  initialDungeon: DungeonDoc | null;
  initialUser: UserProfile;
  initialError?: string | null;
}) {
  const router = useRouter();

  const storeUid = useUserStore((s) => s.uid);
  const storeAuthed = useUserStore((s) => s.isAuthenticated);
  const storeStats = useUserStore((s) => s.stats);
  const storeResources = useUserStore((s) => s.resources);
  const geminiApiKey = useUserStore((s) => s.geminiApiKey);
  const storeHeroClass = useUserStore((s) => s.heroClass);
  const storeMetaPassives = useUserStore((s) => s.metaPassives);
  const addResources = useUserStore((s) => s.addResources);

  const metaStats = storeAuthed && storeUid ? storeStats : initialUser.stats;
  const metaResources = storeAuthed && storeUid ? storeResources : initialUser.resources;
  const uid = storeUid ?? initialUser.uid;
  const heroClass = storeAuthed && storeUid ? storeHeroClass : initialUser.hero_class;
  const metaPassives = storeAuthed && storeUid ? storeMetaPassives : initialUser.meta_passives;
  const effectiveHeroClass: HeroClass = heroClass ?? "WARRIOR";

  const normalizedInitial = useMemo(
    () => (initialDungeon ? normalizeDungeonDoc(initialDungeon) : null),
    [initialDungeon],
  );
  const starterGold = normalizedInitial?.dungeon
    ? START_GOLD_BY_DIFFICULTY[normalizedInitial.dungeon.difficulty ?? "NORMAL"]
    : 0;

  const [phase, setPhase] = useState<EncounterPhase>(() =>
    heroClass && normalizedInitial ? "ENTRY" : "LOADING",
  );
  const [dungeon, setDungeon] = useState<DungeonDoc | null>(
    () => normalizedInitial?.dungeon ?? null,
  );
  const [error, setError] = useState<string | null>(() => initialError);
  const [entryConfirmed, setEntryConfirmed] = useState(false);

  const [roomIndex, setRoomIndex] = useState(0);
  const [pendingFork, setPendingFork] = useState<[number, number] | null>(() =>
    normalizedInitial?.firstStepFork ? [0, 1] : null,
  );
  const [roomToStep, setRoomToStep] = useState<number[] | null>(
    () => normalizedInitial?.roomToStep ?? null,
  );
  const [hero, setHero] = useState<HeroState>(() =>
    buildHero(metaStats, effectiveHeroClass, metaPassives, starterGold),
  );

  const [enemy, setEnemy] = useState<EnemyState | null>(null);
  const [turn, setTurn] = useState<"PLAYER" | "ENEMY">("PLAYER");
  const [defending, setDefending] = useState(false);
  const [rogueFirstStrike, setRogueFirstStrike] = useState(false);
  const [aiAdjudication, setAiAdjudication] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [levelUpPending, setLevelUpPending] = useState(0);
  const [levelUpChoices, setLevelUpChoices] = useState<
    Array<{ id: LevelUpChoiceId; label: string }>
  >([]);
  const [pendingShrineOption, setPendingShrineOption] = useState<
    NonNullable<CardData["options"]>[number] | null
  >(null);

  const [log, setLog] = useState<string[]>(() =>
    normalizedInitial?.dungeon
      ? [`입장 확인: ${normalizedInitial.dungeon.name}`, `지참금: ${starterGold}G`]
      : [],
  );
  const logRef = useRef<HTMLDivElement>(null);
  const shakeControls = useAnimationControls();

  const currentCard = dungeon?.card_list?.[roomIndex] ?? null;
  const totalRooms =
    dungeon?.room_total ?? dungeon?.card_list?.length ?? dungeon?.room_count ?? 0;
  const progressStepIndex = dungeon ? (roomToStep?.[roomIndex] ?? roomIndex) : 0;
  const roomLabel = dungeon ? `${progressStepIndex + 1} / ${dungeon.room_count}` : "";
  const progressRatio =
    dungeon && dungeon.room_count > 0
      ? clamp((progressStepIndex + 1) / dungeon.room_count, 0, 1)
      : 0;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const appendLog = (line: string) => {
    setLog((prev) => [...prev, line].slice(-200));
  };

  const triggerShake = (strength = 7) => {
    shakeControls.start({
      x: [0, -strength, strength, -Math.round(strength * 0.6), Math.round(strength * 0.6), 0],
      transition: { duration: 0.22 },
    }).catch(() => {});
  };

  const confirmEntry = () => {
    if (!dungeon) return;
    if (!dungeonId) return;
    if (entryConfirmed) return;
    setEntryConfirmed(true);
    setPhase(pendingFork ? "FORK" : "ENCOUNTER");
    setLog([
      `던전에 진입했습니다: ${dungeon.name}`,
      `지참금: ${hero.starterGold}G`,
    ]);

    // Best-effort stats update
    updateDoc(doc(db, "dungeons", dungeonId), { play_count: increment(1) }).catch(
      () => {},
    );
  };

  const cancelEntry = () => {
    router.push("/explore");
  };

  const canUseAI = Boolean(geminiApiKey) && aiAdjudication;

  const attemptTrap = async (
    kind: "DODGE" | "DISARM" | "ENDURE",
    dc: number,
    trapDmg: number,
  ) => {
    if (!currentCard) return;
    if (aiBusy) return;

    const roll = (stat: number, bonus = 0) =>
      randInt(1, 20) + Math.floor((stat - 10) / 2) + Math.round(bonus);

    const local = () => {
      if (kind === "ENDURE") {
        const reduced = Math.max(1, Math.round(trapDmg * 0.6));
        appendLog(`버티기: -${reduced} HP`);
        setHero((h) => ({ ...h, hp: Math.max(0, h.hp - reduced) }));
        if (hero.hp - reduced <= 0) endRunDead();
        else finishEncounter(currentCard);
        return;
      }

      const isDisarm = kind === "DISARM";
      const rogueBonus = isDisarm && effectiveHeroClass === "ROGUE" ? 4 : 0;
      const stat = isDisarm ? hero.luk : hero.spd;
      const r = roll(stat, rogueBonus);
      appendLog(`${isDisarm ? "해제" : "회피"} 판정: ${r} vs DC ${dc}`);
      if (r >= dc) {
        appendLog(isDisarm ? "해제 성공" : "피했습니다.");
        finishEncounter(currentCard);
        return;
      }
      appendLog(`함정 피해: -${trapDmg} HP`);
      setHero((h) => ({ ...h, hp: Math.max(0, h.hp - trapDmg) }));
      if (hero.hp - trapDmg <= 0) endRunDead();
      else finishEncounter(currentCard);
    };

    if (!canUseAI) {
      local();
      return;
    }

    setAiBusy(true);
    try {
      const diff = dungeon?.difficulty ?? "NORMAL";
      const prompt = `You are the Game Master AI for a dark fantasy text dungeon.

OUTPUT RULES (STRICT):
- Output ONLY a single valid JSON object. No markdown. No code fences. No extra text.
- All player-facing strings MUST be Korean and MUST NOT contain emojis.

You will judge the outcome of a TRAP encounter choice.

CONTEXT:
- difficulty: ${diff}
- trap: ${JSON.stringify({
        name: currentCard.name,
        description: currentCard.description,
        tags: currentCard.tags ?? [],
        dc,
        base_damage: trapDmg,
      })}
- hero: ${JSON.stringify({
        hp: hero.hp,
        maxHp: hero.maxHp,
        mp: hero.mp,
        maxMp: hero.maxMp,
        atk: hero.atk,
        def: hero.def,
        spd: hero.spd,
        luk: hero.luk,
        gold: hero.gold,
        heroClass: effectiveHeroClass,
      })}
- action:
  - kind: "${kind}"  // DODGE=회피, DISARM=해제, ENDURE=버티기

RETURN JSON SCHEMA:
{
  "success": boolean,
  "log": string[],
  "hp_damage": number,
  "gold_delta": number,
  "effects_add": { "id": string, "turns": number, "stacks": number }[]
}

RULES:
- "log" length must be 1..3 (short lines).
- If kind is "ENDURE": success must be true, and hp_damage must be between 30% and 80% of base_damage.
- If kind is "DODGE" or "DISARM": decide success fairly based on hero stats vs dc (do NOT always succeed or always fail).
- hp_damage must be an integer between 0 and ${Math.max(1, Math.round(trapDmg * 2))}.
- gold_delta must be an integer between -60 and 120.
- effects_add ids must start with "STATUS_" or "BUFF_".`;

      const raw = await generateGeminiJSON(geminiApiKey!, prompt);
      const success = Boolean((raw as any)?.success);
      const logLinesRaw = (raw as any)?.log;
      const logLines = Array.isArray(logLinesRaw)
        ? logLinesRaw
            .filter((v: unknown) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
            .slice(0, 3)
        : [];

      const hpDamageRaw = (raw as any)?.hp_damage;
      const hpDamage = clamp(
        typeof hpDamageRaw === "number" && Number.isFinite(hpDamageRaw)
          ? Math.round(hpDamageRaw)
          : kind === "ENDURE"
            ? Math.max(1, Math.round(trapDmg * 0.6))
            : success
              ? 0
              : trapDmg,
        0,
        Math.max(1, Math.round(trapDmg * 2)),
      );

      const goldDeltaRaw = (raw as any)?.gold_delta;
      const goldDelta = clamp(
        typeof goldDeltaRaw === "number" && Number.isFinite(goldDeltaRaw)
          ? Math.round(goldDeltaRaw)
          : 0,
        -60,
        120,
      );

      const effectsRaw = (raw as any)?.effects_add;
      const effects = Array.isArray(effectsRaw) ? effectsRaw.slice(0, 4) : [];
      const effectsAdd: Array<{ id: string; turns: number; stacks: number }> = [];
      for (const e of effects) {
        if (!e || typeof e !== "object") continue;
        const id = String((e as any).id ?? "").trim().toUpperCase();
        if (!id.startsWith("STATUS_") && !id.startsWith("BUFF_")) continue;
        const turns = clamp(
          typeof (e as any).turns === "number" && Number.isFinite((e as any).turns)
            ? Math.round((e as any).turns)
            : DEFAULT_EFFECT_TURNS,
          1,
          6,
        );
        const stacks = clamp(
          typeof (e as any).stacks === "number" && Number.isFinite((e as any).stacks)
            ? Math.round((e as any).stacks)
            : 1,
          1,
          9,
        );
        effectsAdd.push({ id, turns, stacks });
      }

      for (const line of logLines.length ? logLines : ["판정이 내려집니다."]) {
        appendLog(line);
      }

      setHero((h) => {
        const nextHp = Math.max(0, h.hp - hpDamage);
        let nextEffects = h.effects;
        for (const ef of effectsAdd) {
          nextEffects = upsertEffect(nextEffects, ef.id, {
            turns: ef.turns,
            stacks: ef.stacks,
          });
        }
        return {
          ...h,
          hp: nextHp,
          gold: Math.max(0, h.gold + goldDelta),
          effects: nextEffects,
        };
      });

      if (hpDamage > 0) appendLog(`피해: -${hpDamage} HP`);
      if (goldDelta !== 0) appendLog(`골드 변화: ${goldDelta > 0 ? "+" : ""}${goldDelta}G`);

      if (hero.hp - hpDamage <= 0) endRunDead();
      else finishEncounter(currentCard);
    } catch (e) {
      console.error(e);
      appendLog("AI 판정에 실패했습니다. 수동 판정으로 진행합니다.");
      local();
    } finally {
      setAiBusy(false);
    }
  };

  const applyShrineOption = (opt: NonNullable<CardData["options"]>[number]) => {
    const applyCost = () => {
      // Costs first: some options may be unaffordable.
      const costType = String(opt.cost_type);
      const costNumber = typeof opt.cost_value === "number" ? opt.cost_value : null;

      if (costType === "GOLD_FLAT" && costNumber !== null) {
        if (hero.gold < costNumber) {
          appendLog("골드가 부족합니다.");
          return false;
        }
        setHero((h) => ({ ...h, gold: Math.max(0, h.gold - Math.round(costNumber)) }));
        appendLog(shrineCostLabel(costType, costNumber));
        return true;
      }
      if (costType === "HP_FLAT" && costNumber !== null) {
        setHero((h) => ({ ...h, hp: Math.max(1, h.hp - Math.round(costNumber)) }));
        appendLog(shrineCostLabel(costType, costNumber));
        return true;
      }
      if (costType === "MP_FLAT" && costNumber !== null) {
        setHero((h) => ({ ...h, mp: Math.max(0, h.mp - Math.round(costNumber)) }));
        appendLog(shrineCostLabel(costType, costNumber));
        return true;
      }
      if (costType === "DEF_DOWN" && costNumber !== null) {
        setHero((h) => ({ ...h, def: Math.max(0, h.def - Math.round(costNumber)) }));
        appendLog(shrineCostLabel(costType, costNumber));
        return true;
      }
      if (costType === "MAXHP_PCT_DOWN" && costNumber !== null) {
        const pct = clamp(costNumber, 0, 80) / 100;
        setHero((h) => {
          const nextMax = Math.max(1, Math.round(h.maxHp * (1 - pct)));
          const nextHp = Math.min(nextMax, h.hp);
          return { ...h, maxHp: nextMax, hp: nextHp };
        });
        appendLog(shrineCostLabel(costType, costNumber));
        return true;
      }
      if (costType === "DESTROY_ITEM") {
        const entries = Object.entries(hero.items).filter(([, c]) => c > 0);
        if (entries.length === 0) {
          appendLog("파괴할 아이템이 없습니다.");
          return true;
        }
        const [pickedId] = entries[randInt(0, entries.length - 1)];
        setHero((h) => {
          const nextItems = { ...h.items };
          nextItems[pickedId] = Math.max(0, (nextItems[pickedId] ?? 0) - 1);
          if ((nextItems[pickedId] ?? 0) === 0) delete nextItems[pickedId];
          return { ...h, items: nextItems };
        });
        appendLog(`아이템 파괴: ${pickedId}`);
        appendLog(shrineCostLabel(costType, opt.cost_value));
        return true;
      }

      if (costType === "NO_COST") {
        appendLog("대가 없음");
        return true;
      }
      if (costType === "ADD_DEBUFF_BLEED") {
        setHero((h) => ({
          ...h,
          effects: upsertEffect(h.effects, "STATUS_BLEED", {
            turns: DEFAULT_EFFECT_TURNS,
          }),
        }));
        appendLog(shrineCostLabel(costType, opt.cost_value));
        return true;
      }
      if (costType === "ADD_DEBUFF_WEAK") {
        setHero((h) => ({
          ...h,
          effects: upsertEffect(h.effects, "STATUS_WEAK", {
            turns: DEFAULT_EFFECT_TURNS,
          }),
        }));
        appendLog(shrineCostLabel(costType, opt.cost_value));
        return true;
      }
      if (costType === "ADD_DEBUFF_BLIND") {
        setHero((h) => ({
          ...h,
          effects: upsertEffect(h.effects, "STATUS_BLIND", {
            turns: DEFAULT_EFFECT_TURNS,
          }),
        }));
        appendLog(shrineCostLabel(costType, opt.cost_value));
        return true;
      }
      if (costType === "TIME_PENALTY") {
        const n =
          typeof opt.cost_value === "number" && Number.isFinite(opt.cost_value)
            ? Math.max(1, Math.round(opt.cost_value))
            : dungeon?.difficulty === "EASY"
              ? 30
              : dungeon?.difficulty === "HARD"
                ? 70
                : dungeon?.difficulty === "NIGHTMARE"
                  ? 110
                  : 50;
        setHero((h) => ({ ...h, goldDebt: h.goldDebt + n }));
        appendLog(shrineCostLabel(costType, n));
        return true;
      }
      return true;
    };

    const applyReward = () => {
      const rewardType = String(opt.reward_type);
      const rewardNumber = typeof opt.reward_value === "number" ? opt.reward_value : null;

      if (rewardType === "STAT_ATK_UP" && rewardNumber !== null) {
        setHero((h) => ({ ...h, atk: h.atk + Math.round(rewardNumber) }));
        appendLog(shrineRewardLabel(rewardType, rewardNumber));
      } else if (rewardType === "STAT_DEF_UP" && rewardNumber !== null) {
        setHero((h) => ({ ...h, def: h.def + Math.round(rewardNumber) }));
        appendLog(shrineRewardLabel(rewardType, rewardNumber));
      } else if (rewardType === "STAT_SPD_UP" && rewardNumber !== null) {
        setHero((h) => ({ ...h, spd: h.spd + Math.round(rewardNumber) }));
        appendLog(shrineRewardLabel(rewardType, rewardNumber));
      } else if (rewardType === "STAT_MAXHP_PCT_UP" && rewardNumber !== null) {
        const pct = clamp(rewardNumber, 0, 200) / 100;
        setHero((h) => {
          const add = Math.max(1, Math.round(h.maxHp * pct));
          const nextMax = h.maxHp + add;
          return { ...h, maxHp: nextMax, hp: Math.min(nextMax, h.hp + add) };
        });
        appendLog(shrineRewardLabel(rewardType, rewardNumber));
      } else if (rewardType === "HEAL_FULL") {
        setHero((h) => ({ ...h, hp: h.maxHp, mp: h.maxMp }));
        appendLog("완전 회복");
      } else if (rewardType === "GAIN_GOLD" && rewardNumber !== null) {
        setHero((h) => ({ ...h, gold: h.gold + Math.max(0, Math.round(rewardNumber)) }));
        appendLog(shrineRewardLabel(rewardType, rewardNumber));
      } else if (rewardType === "GAIN_ITEM") {
        const id =
          typeof opt.reward_value === "string" ? opt.reward_value : "ITEM_POTION_S";
        setHero((h) => {
          const nextItems = { ...h.items };
          nextItems[id] = (nextItems[id] ?? 0) + 1;
          return { ...h, items: nextItems };
        });
        appendLog(shrineRewardLabel(rewardType, opt.reward_value));
      } else if (rewardType === "GAIN_RELIC_SHARD") {
        setHero((h) => {
          const nextItems = { ...h.items };
          nextItems.ITEM_RELIC_SHARD = (nextItems.ITEM_RELIC_SHARD ?? 0) + 1;
          return { ...h, items: nextItems };
        });
        appendLog("유물 조각을 획득했습니다.");
      } else if (rewardType === "ALL_STATS_UP") {
        const delta = rewardNumber !== null ? Math.round(rewardNumber) : 1;
        setHero((h) => ({
          ...h,
          atk: h.atk + delta,
          def: h.def + delta,
          spd: h.spd + delta,
        }));
        appendLog(shrineRewardLabel(rewardType, delta));
      } else if (rewardType === "RESET_COOLDOWN") {
        appendLog("쿨타임이 초기화됩니다.");
      } else if (rewardType === "RESURRECT_TOKEN") {
        setHero((h) => {
          const nextItems = { ...h.items };
          nextItems.ITEM_REVIVE_TOKEN = (nextItems.ITEM_REVIVE_TOKEN ?? 0) + 1;
          return { ...h, items: nextItems };
        });
        appendLog("부활 토큰을 획득했습니다.");
      } else if (rewardType === "CLEANSE") {
        appendLog("저주가 옅어집니다.");
      } else {
        appendLog(shrineRewardLabel(rewardType, opt.reward_value));
      }
    };

    return { applyCost, applyReward };
  };

  const applyShrine = (
    opt: NonNullable<CardData["options"]>[number],
    mode: "BOTH" | "REWARD_ONLY" = "BOTH",
  ) => {
    const { applyCost, applyReward } = applyShrineOption(opt);

    if (mode === "BOTH") {
      const ok = applyCost();
      if (!ok) return false;
    }

    // Rewards always apply if we get here.
    applyReward();

    return true;
  };

  // 던전 데이터는 서버에서 프리패치합니다.

  // Initialize encounter when room changes.
  useEffect(() => {
    if (!entryConfirmed) return;
    if (!dungeon) return;
    if (!currentCard) return;
    if (pendingFork) return;

    setDefending(false);
    setEnemy(null);
    setTurn("PLAYER");
    setPhase("ENCOUNTER");
    setPendingShrineOption(null);

    appendLog(`방 ${progressStepIndex + 1}: ${currentCard.name}`);
    appendLog(currentCard.description);

    if (
      currentCard.category === "CARD_TRAP_INSTANT" ||
      currentCard.category === "CARD_TRAP_ROOM"
    ) {
      const diff = dungeon.difficulty ?? "NORMAL";
      const rate = TRAP_TRIGGER_RATE[diff];
      const armed = Math.random() < rate;
      if (!armed) {
        appendLog("장치가 덜컥거리다 멈춥니다. 함정이 불발입니다.");
        setPhase("RESOLVED");
        return;
      }
      appendLog("발밑에서 딸깍 소리가 납니다.");
    }

    if (isCombatCard(currentCard.category)) {
      const s = currentCard.stats!;
      const enemyState: EnemyState = {
        name: currentCard.name,
        maxHp: s.hp,
        hp: s.hp,
        atk: s.atk,
        def: s.def,
        spd: s.spd,
        tags: currentCard.tags ?? [],
        actions: currentCard.actions,
        effects: [],
      };
      setEnemy(enemyState);
      setPhase("COMBAT");

      // Initiative: simple SPD check
      if (effectiveHeroClass === "ROGUE") {
        setRogueFirstStrike(true);
        setTurn("PLAYER");
        appendLog("그림자 속에서 선공을 잡습니다.");
      } else {
        const playerFirst =
          hero.spd + randInt(0, 4) >= enemyState.spd + randInt(0, 4);
        setTurn(playerFirst ? "PLAYER" : "ENEMY");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIndex, dungeon?.name, pendingFork, entryConfirmed]);

  const resolveAndContinueButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors"
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  const chooseForkPath = (idx: 0 | 1) => {
    if (!dungeon) return;
    if (!pendingFork) return;
    const target = pendingFork[idx];
    setPendingFork(null);
    appendLog(idx === 0 ? "왼쪽 길을 선택했습니다." : "오른쪽 길을 선택했습니다.");

    if (!Number.isInteger(target) || target < 0 || target >= totalRooms) {
      setPhase("CLEAR");
      appendLog("길이 막혀 있습니다.");
      return;
    }
    setRoomIndex(target);
  };

  const goNextRoom = () => {
    if (!dungeon) return;

    const links = normalizeRoomLinks(dungeon.room_links, totalRooms);
    const link = links[roomIndex] ?? null;

    setPendingShrineOption(null);
    setEnemy(null);
    setDefending(false);
    setTurn("PLAYER");

    if (link === null) {
      setPhase("CLEAR");
      appendLog("던전을 클리어했습니다.");
      // Best-effort: add gold to user resources
      // Starter gold (지참금) is for in-dungeon spending and should not convert to meta currency.
      // goldDebt reduces the final settlement (e.g., TIME_PENALTY).
      const earnedGold = Math.max(
        0,
        Math.round(hero.gold - hero.starterGold - hero.goldDebt),
      );
      if (uid && earnedGold > 0) {
        addResources({ gold: earnedGold });
        updateDoc(doc(db, "users", uid), {
          "resources.gold": increment(earnedGold),
          lastClearAt: serverTimestamp(),
        }).catch(() => {});
        appendLog(`정산: 보유 골드 +${earnedGold}`);
      }
      appendLog("던전에서 얻은 아이템과 강화는 밖으로 가져올 수 없습니다.");
      return;
    }

    if (Array.isArray(link)) {
      setPendingFork([link[0], link[1]]);
      setPhase("FORK");
      appendLog("갈림길에 도착했습니다.");
      return;
    }

    setRoomIndex(link);
  };

  const endRunDead = () => {
    setPhase("DEAD");
    appendLog("당신은 쓰러졌습니다.");
  };

  const grantRewards = (card: CardData) => {
    let leveled = false;
    const gold = goldFromReward(card.rewards);
    const items = itemsFromReward(card.rewards);

    if (gold > 0) {
      const debt = hero.goldDebt;
      const paid = Math.min(debt, gold);
      const earned = gold - paid;

      if (paid > 0) appendLog(`시간 손실로 상쇄: -${paid}G`);
      if (earned > 0) appendLog(`던전 골드 획득: +${earned}`);

      setHero((h) => ({
        ...h,
        goldDebt: Math.max(0, h.goldDebt - paid),
        gold: h.gold + earned,
      }));
    }
    if (items.length) {
      setHero((h) => {
        const next = { ...h.items };
        for (const id of items) next[id] = (next[id] ?? 0) + 1;
        return { ...h, items: next };
      });
      appendLog(`아이템 획득: ${items.join(", ")}`);
    }

    const diff = dungeon?.difficulty ?? "NORMAL";
    const xpGain = xpFromCard(card, diff);
    if (xpGain > 0) {
      appendLog(`경험치 +${xpGain}`);

      // Predict level-ups for gating UI (state updates happen async).
      let pending = 0;
      let simLevel = hero.level;
      let simXp = hero.xp + xpGain;
      while (pending < 9 && simXp >= xpToNext(simLevel)) {
        simXp -= xpToNext(simLevel);
        simLevel += 1;
        pending += 1;
      }
      if (pending > 0) {
        leveled = true;
        setLevelUpPending(pending);
        setLevelUpChoices(rollLevelUpChoices());
        appendLog(`레벨 업: Lv ${hero.level + pending}`);
        appendLog("레벨 업으로 체력과 정신력이 회복됩니다.");
      }

      setHero((h) => {
        let next: HeroState = { ...h, xp: h.xp + xpGain };
        let didLevel = false;
        while (next.xp >= xpToNext(next.level)) {
          next = {
            ...next,
            xp: next.xp - xpToNext(next.level),
            level: next.level + 1,
            maxHp: next.maxHp + 6,
            maxMp: next.maxMp + 4,
          };
          didLevel = true;
        }
        if (didLevel) {
          next = { ...next, hp: next.maxHp, mp: next.maxMp };
        }
        return next;
      });
    }

    return leveled;
  };

  const finishEncounter = (card: CardData) => {
    const leveled = grantRewards(card);
    setPhase(leveled ? "LEVEL_UP" : "RESOLVED");
  };

  const endPlayerTurn = (from?: HeroState) => {
    const h = from ?? hero;
    const { dmg, lines } = calcEndOfTurnDot(h.maxHp, h.effects);
    const nextHp = dmg > 0 ? Math.max(0, h.hp - dmg) : h.hp;
    if (lines.length) for (const line of lines) appendLog(line);
    const nextEffects = tickDownEffects(h.effects, 1);
    const clericRegen =
      effectiveHeroClass === "CLERIC" ? Math.max(0, Math.round(h.maxHp * 0.05)) : 0;
    const healedHp =
      clericRegen > 0 ? Math.min(h.maxHp, nextHp + clericRegen) : nextHp;
    if (clericRegen > 0) appendLog(`은총: +${clericRegen} HP`);

    setHero({ ...h, hp: healedHp, effects: nextEffects });
    if (healedHp <= 0) {
      endRunDead();
      return;
    }
    setTurn("ENEMY");
  };

  const endEnemyTurn = (from?: EnemyState) => {
    const e = from ?? enemy;
    if (!e) {
      setTurn("PLAYER");
      return;
    }
    const { dmg, lines } = calcEndOfTurnDot(e.maxHp, e.effects);
    const nextHp = dmg > 0 ? Math.max(0, e.hp - dmg) : e.hp;
    if (lines.length) for (const line of lines) appendLog(line);
    const nextEffects = tickDownEffects(e.effects, 1);
    const nextEnemy = { ...e, hp: nextHp, effects: nextEffects };
    setEnemy(nextEnemy);

    if (nextHp <= 0) {
      appendLog(`${e.name} 처치`);
      if (currentCard?.category === "CARD_SHRINE" && pendingShrineOption) {
        appendLog("제단의 계약이 성립됩니다.");
        applyShrine(pendingShrineOption, "REWARD_ONLY");
        setPendingShrineOption(null);
      }
      finishEncounter(currentCard!);
      return;
    }

    setTurn("PLAYER");
  };

  const playerAttack = (
    mul: number,
    skillName: string,
    heroAfterAction?: HeroState,
    onHitEffect?: { id: string; chance: number; stacks?: number; turns?: number },
    attackAttr?: string | null,
  ) => {
    if (!enemy) return;

    const attacker = heroAfterAction ?? hero;
    if (hasEffect(attacker.effects, "STATUS_CONFUSION") && Math.random() < 0.35) {
      appendLog("혼란으로 인해 행동에 실패했습니다.");
      endPlayerTurn(attacker);
      return;
    }
    const blindMiss =
      hasEffect(attacker.effects, "STATUS_BLIND") && Math.random() < 0.35;
    if (blindMiss) {
      appendLog("실명으로 공격이 빗나갑니다.");
      endPlayerTurn(attacker);
      return;
    }

    const forcedFirstCrit = effectiveHeroClass === "ROGUE" && rogueFirstStrike;
    if (forcedFirstCrit) setRogueFirstStrike(false);
    const crit =
      forcedFirstCrit || Math.random() < calcCritChance(Math.max(0, attacker.luk));
    const critMul = crit ? 1.5 : 1.0;

    const atk =
      hasEffect(attacker.effects, "STATUS_WEAK")
        ? Math.max(1, Math.round(attacker.atk * 0.75))
        : attacker.atk;
    const attr = damageFactorFor(attackAttr, enemy.tags);
    const dmg =
      attr.factor === 0
        ? 0
        : calcDamage(atk, enemy.def, mul * attr.factor * critMul);
    const nextHp = enemy.hp - dmg;
    const willApplyEffect =
      Boolean(onHitEffect) &&
      nextHp > 0 &&
      Math.random() <= clamp(onHitEffect!.chance, 0, 1);

    setEnemy((e) => {
      if (!e) return e;
      const hp = Math.max(0, e.hp - dmg);
      const effects =
        willApplyEffect && hp > 0
          ? upsertEffect(e.effects, onHitEffect!.id, {
              stacks: onHitEffect!.stacks ?? 1,
              turns: onHitEffect!.turns ?? DEFAULT_EFFECT_TURNS,
            })
          : e.effects;
      return { ...e, hp, effects };
    });
    const note = attr.note ? ` (${attr.note})` : "";
    appendLog(`${skillName}: ${enemy.name}에게 ${dmg} 피해${note}`);
    if (crit) {
      appendLog("치명타!");
      triggerShake(10);
    }

    if (nextHp <= 0) {
      appendLog(`${enemy.name} 처치`);
      if (currentCard?.category === "CARD_SHRINE" && pendingShrineOption) {
        appendLog("제단의 계약이 성립됩니다.");
        applyShrine(pendingShrineOption, "REWARD_ONLY");
        setPendingShrineOption(null);
      }
      finishEncounter(currentCard!);
      return;
    }
    if (willApplyEffect) {
      appendLog(`${enemy.name}에게 ${effectLabel(onHitEffect!.id)} 부여`);
    }
    endPlayerTurn(attacker);
  };

  const enemyAct = () => {
    if (!enemy) return;

    // Start-of-turn effects for enemy
    const startHot = calcStartOfTurnHot(enemy.maxHp, enemy.hp, enemy.effects);
    let enemyAfterStart: EnemyState = enemy;
    if (startHot.heal > 0) {
      for (const line of startHot.lines) appendLog(line);
      enemyAfterStart = {
        ...enemy,
        hp: Math.min(enemy.maxHp, enemy.hp + startHot.heal),
      };
      setEnemy(enemyAfterStart);
    }

    // Crowd-control: stunned enemy loses its turn
    if (hasEffect(enemyAfterStart.effects, "STATUS_STUN")) {
      appendLog(`${enemyAfterStart.name}이(가) 기절했습니다.`);
      endEnemyTurn(enemyAfterStart);
      return;
    }

    const action = pickEnemyAction(
      enemyAfterStart.actions,
      enemyAfterStart.hp / enemyAfterStart.maxHp,
    );
    const mul = action?.value ?? 1.0;
    const msg = action?.msg ?? `${enemyAfterStart.name}의 공격`;

    const blindMiss =
      hasEffect(enemyAfterStart.effects, "STATUS_BLIND") && Math.random() < 0.35;
    if (blindMiss) {
      appendLog(`${msg} (빗나감)`);
      setDefending(false);
      endEnemyTurn(enemyAfterStart);
      return;
    }

    const atk =
      hasEffect(enemyAfterStart.effects, "STATUS_WEAK")
        ? Math.max(1, Math.round(enemyAfterStart.atk * 0.75))
        : enemyAfterStart.atk;
    const ironWill =
      effectiveHeroClass === "WARRIOR" && hero.maxHp > 0 && hero.hp / hero.maxHp <= 0.3;
    const reduction = (defending ? 0.5 : 1) * (ironWill ? 0.7 : 1);
    const dmg = calcDamage(atk, hero.def, mul, reduction);

    appendLog(msg);
    const inflict = ATTR_INFLICTS_STATUS.find((x) =>
      (enemyAfterStart.tags ?? []).includes(x.attr),
    );
    const willInflict =
      Boolean(inflict) && Math.random() <= clamp(inflict!.chance, 0, 1);
    const resistChance = clamp(0.08 + (hero.luk - 10) * 0.01, 0, 0.35);
    const resisted = willInflict && Math.random() < resistChance;

    if (willInflict && resisted) {
      appendLog(`저항: ${effectLabel(inflict!.status)}`);
    } else if (willInflict) {
      appendLog(`${effectLabel(inflict!.status)} 부여`);
    }

    const manaShield =
      effectiveHeroClass === "MAGE" && hero.mp > 0 ? Math.max(0, Math.round(dmg * 0.4)) : 0;
    const mpAbsorb = Math.min(hero.mp, manaShield);
    const hpDmg = Math.max(0, dmg - mpAbsorb);

    setHero((h) => {
      const nextHp = Math.max(0, h.hp - hpDmg);
      const nextMp = Math.max(0, h.mp - mpAbsorb);
      const nextEffects = willInflict && !resisted
        ? upsertEffect(h.effects, inflict!.status, { turns: DEFAULT_EFFECT_TURNS })
        : h.effects;
      return { ...h, hp: nextHp, mp: nextMp, effects: nextEffects };
    });
    if (ironWill) appendLog("불굴: 피해 감소");
    appendLog(
      mpAbsorb > 0
        ? `피해: -${hpDmg} HP, -${mpAbsorb} MP`
        : `피해: -${hpDmg} HP`,
    );
    if (hpDmg >= Math.max(1, Math.round(hero.maxHp * 0.18))) triggerShake(8);
    setDefending(false);

    if (hero.hp - hpDmg <= 0) {
      endRunDead();
      return;
    }

    endEnemyTurn(enemyAfterStart);
  };

  // Auto-run enemy turns during combat.
  useEffect(() => {
    if (phase !== "COMBAT") return;
    if (turn !== "ENEMY") return;
    if (!enemy) return;
    const t = setTimeout(() => enemyAct(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, enemy?.hp]);

  // Start-of-turn effects for the player (regen, stun skip).
  useEffect(() => {
    if (phase !== "COMBAT") return;
    if (turn !== "PLAYER") return;

    const hot = calcStartOfTurnHot(hero.maxHp, hero.hp, hero.effects);
    const nextHero =
      hot.heal > 0
        ? { ...hero, hp: Math.min(hero.maxHp, hero.hp + hot.heal) }
        : hero;
    if (hot.heal > 0) {
      for (const line of hot.lines) appendLog(line);
      setHero(nextHero);
    }

    if (hasEffect(nextHero.effects, "STATUS_STUN")) {
      appendLog("당신은 기절했습니다.");
      window.setTimeout(() => endPlayerTurn(nextHero), 320);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase]);

  // MP=0 -> Confusion (per docs). Keep it brief and readable.
  useEffect(() => {
    if (phase !== "COMBAT") return;
    if (hero.mp > 0) return;
    if (hasEffect(hero.effects, "STATUS_CONFUSION")) return;
    setHero((h) => ({
      ...h,
      effects: upsertEffect(h.effects, "STATUS_CONFUSION", {
        turns: DEFAULT_EFFECT_TURNS,
      }),
    }));
    appendLog("정신이 텅 비어버립니다. 혼란 상태!");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero.mp, phase]);

  const applyLevelUp = (choice: { id: LevelUpChoiceId; label: string }) => {
    appendLog(`레벨 업 선택: ${choice.label}`);
    setHero((h) => applyLevelUpChoice(h, choice.id));
    setLevelUpPending((n) => {
      const next = Math.max(0, n - 1);
      if (next <= 0) {
        setLevelUpChoices([]);
        setPhase("RESOLVED");
      } else {
        setLevelUpChoices(rollLevelUpChoices());
        setPhase("LEVEL_UP");
      }
      return next;
    });
  };

  const actionPanel = (() => {
    if (phase === "ENTRY") {
      return (
        <div className="text-sm text-gray-500">
          던전 입장 확인을 기다립니다.
        </div>
      );
    }
    if (phase === "LEVEL_UP") {
      return (
        <div className="grid gap-2">
          <div className="text-sm text-gray-500 px-1">
            레벨 업. 보너스를 선택하세요.
          </div>
          {levelUpChoices.length === 0 ? (
            <div className="text-sm text-gray-600 px-2 py-2">
              선택지를 불러오지 못했습니다.
            </div>
          ) : (
            levelUpChoices.map((c) => (
              <button
                key={c.id}
                onClick={() => applyLevelUp(c)}
                className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
              >
                {c.label}
              </button>
            ))
          )}
          {levelUpPending > 1 && (
            <div className="text-xs text-gray-600 px-1">
              추가 레벨 업: {levelUpPending - 1}회
            </div>
          )}
        </div>
      );
    }
    if (phase === "FORK") {
      return (
        <div className="grid gap-2">
          <div className="text-sm text-gray-500 px-1">
            갈림길이다. 문을 선택하세요.
          </div>
          {!pendingFork ? (
            <div className="text-sm text-gray-600 px-2 py-2">
              갈림길 정보를 불러오지 못했습니다.
            </div>
          ) : (
            <>
              <button
                onClick={() => chooseForkPath(0)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
              >
                <span className="font-semibold">왼쪽 길</span>
                <FaArrowRight className="text-gray-500" />
              </button>
              <button
                onClick={() => chooseForkPath(1)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
              >
                <span className="font-semibold">오른쪽 길</span>
                <FaArrowRight className="text-gray-500" />
              </button>
            </>
          )}
          <button
            onClick={() => {
              appendLog("조심스럽게 뒤로 물러납니다.");
              router.push("/explore");
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaChevronLeft />
            <span>나가기</span>
          </button>
        </div>
      );
    }
    if (phase === "CLEAR") {
      return (
        <div className="space-y-2">
          {resolveAndContinueButton("로비로", <FaChevronLeft />, () =>
            router.push("/"),
          )}
        </div>
      );
    }
    if (phase === "DEAD") {
      return (
        <div className="space-y-2">
          {resolveAndContinueButton("다시 로비로", <FaChevronLeft />, () =>
            router.push("/"),
          )}
        </div>
      );
    }
    if (phase === "RESOLVED") {
      return (
        <div className="space-y-2">
          {resolveAndContinueButton("다음 방", <FaArrowRight />, goNextRoom)}
        </div>
      );
    }

    if (!currentCard) return null;

    // Combat
    if (phase === "COMBAT" && enemy) {
      const canCast = hero.mp >= 10 && turn === "PLAYER";
      const canPotion = (hero.items.ITEM_POTION_S ?? 0) > 0 && turn === "PLAYER";
      const hasSmoke = (hero.items.ITEM_SMOKE_BOMB ?? 0) > 0;
      const hasSharpen = (hero.items.ITEM_SHARPENING_STONE ?? 0) > 0;
      const hasArmorPatch = (hero.items.ITEM_ARMOR_PATCH ?? 0) > 0;
      return (
        <div className="grid gap-2">
          {(hero.effects.length > 0 || enemy.effects.length > 0) && (
            <div className="flex items-start justify-between gap-2 pb-1">
              <div className="flex flex-wrap gap-1">
                {hero.effects.slice(0, 8).map((e, i) => (
                  <div
                    key={`H-${e.id}-${i}`}
                    className="relative w-6 h-6 rounded border border-gray-800 bg-gray-950/40 flex items-center justify-center text-gray-200"
                    title={`${effectLabel(e.id)} (${e.turns}턴)`}
                  >
                    <KeywordIcon id={e.id} className="w-3.5 h-3.5" />
                    <div className="absolute -bottom-1 -right-1 text-[9px] px-1 rounded bg-black/80 border border-gray-800 text-gray-200">
                      {e.turns}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 justify-end">
                {enemy.effects.slice(0, 8).map((e, i) => (
                  <div
                    key={`E-${e.id}-${i}`}
                    className="relative w-6 h-6 rounded border border-gray-800 bg-gray-950/40 flex items-center justify-center text-gray-200"
                    title={`${effectLabel(e.id)} (${e.turns}턴)`}
                  >
                    <KeywordIcon id={e.id} className="w-3.5 h-3.5" />
                    <div className="absolute -bottom-1 -right-1 text-[9px] px-1 rounded bg-black/80 border border-gray-800 text-gray-200">
                      {e.turns}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() =>
              playerAttack(1.0, "공격", undefined, undefined, HERO_BASE_ATTR[effectiveHeroClass])
            }
            disabled={turn !== "PLAYER"}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaPlay />
            <span>공격</span>
          </button>
          <button
            onClick={() => {
              setDefending(true);
              appendLog("방어 태세");
              endPlayerTurn();
            }}
            disabled={turn !== "PLAYER"}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaShieldAlt />
            <span>방어</span>
          </button>
          <button
            onClick={() => {
              if (!canCast) return;
              const nextHero = { ...hero, mp: hero.mp - 10 };
              setHero(nextHero);
              playerAttack(1.6, "화염구", nextHero, {
                id: "STATUS_BURN",
                chance: 0.4,
                turns: 2,
              }, "ATTR_FIRE");
            }}
            disabled={!canCast}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
          >
            <FaBolt />
            <span>화염구 (MP 10)</span>
          </button>
          <button
            onClick={() => {
              if (!canPotion) return;
              setHero((h) => {
                const nextItems = { ...h.items };
                nextItems.ITEM_POTION_S = Math.max(0, (nextItems.ITEM_POTION_S ?? 0) - 1);
                const heal = Math.round(h.maxHp * 0.35);
                appendLog(`포션 사용: +${heal} HP`);
                return { ...h, hp: Math.min(h.maxHp, h.hp + heal), items: nextItems };
              });
            }}
            disabled={!canPotion}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaHeart />
            <span>포션</span>
          </button>
          {hasSharpen && (
            <button
              onClick={() => {
                if (turn !== "PLAYER") return;
                const nextItems = { ...hero.items };
                nextItems.ITEM_SHARPENING_STONE = Math.max(
                  0,
                  (nextItems.ITEM_SHARPENING_STONE ?? 0) - 1,
                );
                if ((nextItems.ITEM_SHARPENING_STONE ?? 0) === 0)
                  delete nextItems.ITEM_SHARPENING_STONE;
                appendLog("숫돌 사용: 공격력 +2");
                endPlayerTurn({ ...hero, atk: hero.atk + 2, items: nextItems });
              }}
              disabled={turn !== "PLAYER"}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
            >
              <FaBolt />
              <span>숫돌</span>
            </button>
          )}
          {hasArmorPatch && (
            <button
              onClick={() => {
                if (turn !== "PLAYER") return;
                const nextItems = { ...hero.items };
                nextItems.ITEM_ARMOR_PATCH = Math.max(
                  0,
                  (nextItems.ITEM_ARMOR_PATCH ?? 0) - 1,
                );
                if ((nextItems.ITEM_ARMOR_PATCH ?? 0) === 0)
                  delete nextItems.ITEM_ARMOR_PATCH;
                appendLog("갑옷 수선: 방어력 +2");
                endPlayerTurn({ ...hero, def: hero.def + 2, items: nextItems });
              }}
              disabled={turn !== "PLAYER"}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
            >
              <FaShieldAlt />
              <span>수선 키트</span>
            </button>
          )}
          {hasSmoke && (
            <button
              onClick={() => {
                if (turn !== "PLAYER") return;
                setHero((h) => {
                  const nextItems = { ...h.items };
                  nextItems.ITEM_SMOKE_BOMB = Math.max(
                    0,
                    (nextItems.ITEM_SMOKE_BOMB ?? 0) - 1,
                  );
                  if ((nextItems.ITEM_SMOKE_BOMB ?? 0) === 0)
                    delete nextItems.ITEM_SMOKE_BOMB;
                  appendLog("연막탄 사용: 확실한 도주");
                  return { ...h, items: nextItems };
                });
                if (currentCard?.category === "CARD_SHRINE" && pendingShrineOption) {
                  appendLog("제단의 계약을 포기했습니다.");
                  setPendingShrineOption(null);
                }
                setPhase("RESOLVED");
              }}
              disabled={turn !== "PLAYER"}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
            >
              <FaShoePrints />
              <span>연막탄</span>
            </button>
          )}
          <button
            onClick={() => {
              if (turn !== "PLAYER") return;
              const chance = clamp(0.35 + (hero.spd - enemy.spd) * 0.02, 0.1, 0.85);
              const ok = Math.random() < chance;
              if (ok) {
                appendLog("도주 성공");
                if (currentCard?.category === "CARD_SHRINE" && pendingShrineOption) {
                  appendLog("제단의 계약을 포기했습니다.");
                  setPendingShrineOption(null);
                }
                setPhase("RESOLVED");
                return;
              }
              appendLog("도주 실패");
              endPlayerTurn();
            }}
            disabled={turn !== "PLAYER"}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaShoePrints />
            <span>도주</span>
          </button>
        </div>
      );
    }

    // Trap
    if (
      currentCard.category === "CARD_TRAP_INSTANT" ||
      currentCard.category === "CARD_TRAP_ROOM"
    ) {
      const dc = currentCard.check_info?.difficulty ?? 15;
      const dmgBase =
        dungeon?.difficulty === "EASY"
          ? 0.1
          : dungeon?.difficulty === "HARD"
            ? 0.2
            : dungeon?.difficulty === "NIGHTMARE"
              ? 0.28
          : 0.15;
      const trapDmg = Math.max(1, Math.round(hero.maxHp * dmgBase));
      return (
        <div className="grid gap-2">
          <button
            disabled={aiBusy}
            onClick={() => attemptTrap("DODGE", dc, trapDmg)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaShoePrints />
            <span>회피 시도</span>
          </button>
          <button
            disabled={aiBusy}
            onClick={() => attemptTrap("DISARM", dc, trapDmg)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaHandPaper />
            <span>해제 시도</span>
          </button>
          <button
            disabled={aiBusy}
            onClick={() => attemptTrap("ENDURE", dc, trapDmg)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaShieldAlt />
            <span>버티기</span>
          </button>
        </div>
      );
    }

    // Treasure
    if (currentCard.category === "CARD_LOOT_CHEST") {
      const isMimic = currentCard.mimic_data?.isMimic === true;
      return (
        <div className="grid gap-2">
          <button
            onClick={() => {
              if (isMimic) {
                appendLog("상자가 꿈틀거립니다. 미믹입니다.");
                // Convert into a combat encounter with fallback stats.
                const s = currentCard.mimic_data?.stats ?? {
                  hp: 110,
                  atk: 14,
                  def: 3,
                  spd: 10,
                };
                setEnemy({
                  name: "미믹",
                  maxHp: s.hp,
                  hp: s.hp,
                  atk: s.atk,
                  def: s.def,
                  spd: s.spd,
                  tags: ["TAG_BEAST"],
                  effects: [],
                });
                setPhase("COMBAT");
                setTurn(hero.spd >= s.spd ? "PLAYER" : "ENEMY");
                return;
              }
              appendLog("상자를 열었습니다.");
              finishEncounter(currentCard);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaPlay />
            <span>열기</span>
          </button>
          <button
            onClick={() => {
              appendLog(isMimic ? "숨소리가 들립니다." : "차가운 금속음이 납니다.");
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaHandPaper />
            <span>관찰</span>
          </button>
          <button
            onClick={() => {
              appendLog("강제로 부쉈습니다.");
              // Reduced reward
              finishEncounter({
                ...currentCard,
                rewards: {
                  ...currentCard.rewards,
                  gold: Math.floor(goldFromReward(currentCard.rewards) * 0.6),
                },
              });
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaSkull />
            <span>부수기</span>
          </button>
          <button
            onClick={() => {
              appendLog("지나칩니다.");
              setPhase("RESOLVED");
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaArrowRight />
            <span>지나치기</span>
          </button>
        </div>
      );
    }

    // Shrine
    if (currentCard.category === "CARD_SHRINE") {
      const opts = currentCard.options ?? [];
      return (
        <div className="grid gap-2">
          {opts.slice(0, 5).map((opt) => {
            const rewardType = String(opt.reward_type);
            const costType = String(opt.cost_type);
            const unaffordable =
              costType === "GOLD_FLAT" &&
              typeof opt.cost_value === "number" &&
              hero.gold < opt.cost_value;

            return (
              <button
                key={opt.id}
                disabled={unaffordable}
                onClick={() => {
                  appendLog(opt.text);

                  if (costType === "SUMMON_ENEMY") {
                    const diff = dungeon?.difficulty ?? "NORMAL";
                    const s = SHRINE_GUARDIAN_STATS[diff];
                    setPendingShrineOption(opt);
                    appendLog("제단이 수호자를 소환합니다.");
                    const guardian: EnemyState = {
                      name: "제단 수호자",
                      maxHp: s.hp,
                      hp: s.hp,
                      atk: s.atk,
                      def: s.def,
                      spd: s.spd,
                      tags: ["TAG_ELITE", "TAG_UNDEAD"],
                      actions: [
                        {
                          trigger: "ON_TURN",
                          type: "LOGIC_ATTACK",
                          value: 1.0,
                          msg: "수호자가 공격해옵니다.",
                        },
                      ],
                      effects: [],
                    };
                    setEnemy(guardian);
                    setDefending(false);
                    setPhase("COMBAT");
                    const playerFirst =
                      hero.spd + randInt(0, 4) >= guardian.spd + randInt(0, 4);
                    setTurn(playerFirst ? "PLAYER" : "ENEMY");
                    return;
                  }

                  const ok = applyShrine(opt, "BOTH");
                  if (!ok) return;
                  finishEncounter(currentCard);
                }}
                className={`w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 transition-colors ${
                  unaffordable
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:border-gray-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 flex items-center gap-2 pt-0.5">
                    <div className="w-8 h-8 text-primary">
                      <ShrineRewardIcon rewardType={rewardType} className="w-8 h-8" />
                    </div>
                    <div className="w-8 h-8 text-red-300/90">
                      <ShrineCostIcon costType={costType} className="w-8 h-8" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-200 leading-snug">
                      {opt.text}
                    </div>
                    <div className="mt-1 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-primary">보상</span>
                        <span className="text-gray-300">
                          {shrineRewardLabel(rewardType, opt.reward_value)}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="text-red-300">대가</span>
                        <span className="text-gray-300">
                          {shrineCostLabel(costType, opt.cost_value)}
                        </span>
                      </span>
                    </div>
                    {unaffordable && (
                      <div className="mt-1 text-xs text-red-400">
                        골드가 부족합니다.
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => {
              appendLog("아무것도 하지 않고 떠납니다.");
              setPhase("RESOLVED");
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaArrowRight />
            <span>무시</span>
          </button>
        </div>
      );
    }

    // Rest
    if (currentCard.category.startsWith("CARD_REST_")) {
      const actions = (currentCard.actions ?? []).slice(0, 4);
      const healPct = 0.35;
      const defaultActions: { key: string; label: string; type: string }[] = [
        { key: "REST_HEAL", label: "휴식하기", type: "REST_HEAL" },
        { key: "REST_SCOUT", label: "주변을 경계한다", type: "REST_SCOUT" },
      ];

      const list: Array<{
        key: string;
        label: string;
        type: string;
        value?: number;
      }> =
        actions.length > 0
          ? actions.map((a, i) => ({
              key: `${a.type}-${i}`,
              label: a.msg,
              type: a.type,
              value: a.value,
            }))
          : defaultActions;

      return (
        <div className="grid gap-2">
          {list.map((a) => (
            <button
              key={a.key}
              onClick={() => {
                appendLog(a.label);
                if (String(a.type).includes("HEAL")) {
                  const healHp = Math.round(hero.maxHp * healPct);
                  const healMp = Math.round(hero.maxMp * healPct);
                  setHero((h) => ({
                    ...h,
                    hp: Math.min(h.maxHp, h.hp + healHp),
                    mp: Math.min(h.maxMp, h.mp + healMp),
                  }));
                  appendLog(`회복: +${healHp} HP, +${healMp} MP`);
                } else if (String(a.type).includes("SMITH")) {
                  setHero((h) => ({ ...h, atk: h.atk + 2 }));
                  appendLog("무기가 강화됩니다.");
                }
                setPhase("RESOLVED");
              }}
              className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      );
    }

    // NPC: Trader
    if (currentCard.category === "CARD_NPC_TRADER") {
      const list = (currentCard.trade_list ?? []).slice(0, 6);
      return (
        <div className="grid gap-2">
          {list.length === 0 ? (
            <div className="text-sm text-gray-500 px-2 py-2">
              판매 목록이 없습니다.
            </div>
          ) : (
            list.map((it) => (
              <button
                key={it.id}
                onClick={() => {
                  if (hero.gold < it.price) {
                    appendLog("골드가 부족합니다.");
                    return;
                  }
                  setHero((h) => {
                    const nextItems = { ...h.items };
                    nextItems[it.id] = (nextItems[it.id] ?? 0) + 1;
                    return { ...h, gold: h.gold - it.price, items: nextItems };
                  });
                  appendLog(`구매: ${it.id} (-${it.price}G)`);
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
              >
                <span className="truncate">{it.id}</span>
                <span className="text-sm text-gray-400">{it.price}G</span>
              </button>
            ))
          )}
          <button
            onClick={() => {
              appendLog("거래를 마칩니다.");
              setPhase("RESOLVED");
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaArrowRight />
            <span>떠나기</span>
          </button>
        </div>
      );
    }

    // NPC: Talk / Quest (minimal)
    if (
      currentCard.category === "CARD_NPC_TALK" ||
      currentCard.category === "CARD_NPC_QUEST"
    ) {
      return (
        <div className="space-y-2">
          {resolveAndContinueButton("계속", <FaArrowRight />, () =>
            setPhase("RESOLVED"),
          )}
        </div>
      );
    }

    // NPC / Event: minimal handling
    return (
      <div className="space-y-2">
        {resolveAndContinueButton("계속", <FaArrowRight />, () =>
          finishEncounter(currentCard),
        )}
      </div>
    );
  })();

  if (!heroClass) {
    return (
      <div className="min-h-screen bg-background text-text-main flex items-center justify-center p-6">
        <div className="w-full max-w-lg border border-gray-800 bg-surface/60 rounded-lg p-6">
          <div className="flex items-center gap-2 text-gray-200 font-bold">
            <FaUserShield className="text-primary" />
            <span>영웅이 필요합니다</span>
          </div>
          <div className="mt-2 text-gray-500">
            던전을 플레이하려면 먼저 영웅 클래스를 선택해야 합니다.
          </div>
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <Link
              href="/hero"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors"
            >
              영웅 만들기
            </Link>
            <Link
              href="/explore"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
            >
              던전 목록
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-text-main flex items-center justify-center p-6">
        <div className="w-full max-w-xl border border-gray-800 bg-surface/60 rounded-lg p-6">
          <div className="text-lg font-bold text-gray-200">오류</div>
          <div className="mt-2 text-gray-500">{error}</div>
          <div className="mt-4">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors"
            >
              <FaChevronLeft />
              던전 목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "LOADING") {
    return (
      <div className="min-h-screen bg-background text-text-main flex items-center justify-center">
        <div className="border border-gray-800 bg-surface/60 rounded-lg p-6 text-gray-300">
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-main font-serif flex flex-col">
      <header className="relative h-16 border-b border-gray-800 bg-surface/90 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-6 sticky top-0 z-40">
        <div className="min-w-0 justify-self-start">
          <div className="text-gray-200 font-bold truncate">
            {dungeon?.name ?? "던전"}
          </div>
          <div className="text-xs text-gray-600">
            방 {roomLabel} {phase === "COMBAT" ? "(전투)" : ""}
          </div>
        </div>
        <AppLogoLink className="justify-self-center" />
        <div className="flex items-center gap-3 justify-self-end min-w-0">
          <div className="hidden md:block text-xs text-gray-500 border border-gray-800 bg-black/40 rounded px-3 py-2">
            <div className="flex items-center gap-2">
              <FaHeart className="text-red-400" />
              <span className="text-gray-200">
                {hero.hp} / {hero.maxHp}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <FaBolt className="text-gray-300" />
              <span className="text-gray-200">
                {hero.mp} / {hero.maxMp}
              </span>
            </div>
            {hero.effects.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 max-w-[160px]">
                {hero.effects.slice(0, 6).map((e, i) => (
                  <div
                    key={`${e.id}-${i}`}
                    className="relative w-6 h-6 rounded border border-gray-800 bg-gray-950/40 flex items-center justify-center text-gray-200"
                    title={`${effectLabel(e.id)} (${e.turns}턴)`}
                  >
                    <KeywordIcon id={e.id} className="w-3.5 h-3.5" />
                    <div className="absolute -bottom-1 -right-1 text-[9px] px-1 rounded bg-black/80 border border-gray-800 text-gray-200">
                      {e.turns}
                    </div>
                    {e.stacks > 1 && (
                      <div className="absolute -bottom-1 -left-1 text-[9px] px-1 rounded bg-black/80 border border-gray-800 text-gray-200">
                        x{e.stacks}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Link
            href="/explore"
            className="p-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            title="나가기"
          >
            <FaChevronLeft />
          </Link>
        </div>
        <div className="absolute left-0 right-0 bottom-0 h-1 bg-black/40">
          <div
            className="h-1 bg-primary/70"
            style={{ width: `${Math.round(progressRatio * 100)}%` }}
          />
        </div>
      </header>

      <motion.main
        animate={shakeControls}
        className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 grid gap-6 lg:grid-cols-[360px_1fr] items-start"
      >
        <section className="grid gap-4 justify-center lg:justify-start">
          <div className="flex justify-center lg:justify-start">
            {phase !== "FORK" && phase !== "ENTRY" && currentCard ? (
              <CardView card={currentCard} className="w-72 h-[420px]" />
            ) : (
              <div className="w-72 h-[420px] border border-gray-800 bg-surface/60 rounded-lg" />
            )}
          </div>

          <div className="w-72 border border-gray-800 bg-surface/60 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-3 font-mono uppercase tracking-wider">
              나의 상태
            </div>
            <div className="grid gap-3">
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">HP</span>
                  <span className="text-gray-200 font-bold">
                    {hero.hp} / {hero.maxHp}
                  </span>
                </div>
                <div className="h-2 rounded bg-black/40 border border-gray-800 overflow-hidden">
                  <div
                    className="h-2 bg-red-500/70"
                    style={{
                      width: `${hero.maxHp > 0 ? Math.round((hero.hp / hero.maxHp) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-gray-500">MP</span>
                  <span className="text-gray-200 font-bold">
                    {hero.mp} / {hero.maxMp}
                  </span>
                </div>
                <div className="h-2 rounded bg-black/40 border border-gray-800 overflow-hidden">
                  <div
                    className="h-2 bg-primary/60"
                    style={{
                      width: `${hero.maxMp > 0 ? Math.round((hero.mp / hero.maxMp) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <MiniStat label="LV" value={hero.level} />
                <MiniStat label="XP" value={`${hero.xp}/${xpToNext(hero.level)}`} />
                <MiniStat label="ATK" value={hero.atk} />
                <MiniStat label="DEF" value={hero.def} />
                <MiniStat label="SPD" value={hero.spd} />
                <MiniStat label="LUK" value={hero.luk} />
                <MiniStat label="GOLD" value={hero.gold} />
                <MiniStat label="DEBT" value={hero.goldDebt} />
              </div>

              {hero.effects.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">효과</div>
                  <div className="flex flex-wrap gap-1">
                    {hero.effects.slice(0, 12).map((e, i) => (
                      <div
                        key={`${e.id}-${i}`}
                        className="relative w-7 h-7 rounded border border-gray-800 bg-gray-950/40 flex items-center justify-center text-gray-200"
                        title={`${effectLabel(e.id)} (${e.turns}턴)`}
                      >
                        <KeywordIcon id={e.id} className="w-4 h-4" />
                        <div className="absolute -bottom-1 -right-1 text-[9px] px-1 rounded bg-black/80 border border-gray-800 text-gray-200">
                          {e.turns}
                        </div>
                        {e.stacks > 1 && (
                          <div className="absolute -bottom-1 -left-1 text-[9px] px-1 rounded bg-black/80 border border-gray-800 text-gray-200">
                            x{e.stacks}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(hero.items).length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">가방</div>
                  <div className="grid gap-1 text-xs text-gray-300">
                    {Object.entries(hero.items)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .slice(0, 8)
                      .map(([id, count]) => (
                        <div key={id} className="flex items-center justify-between">
                          <span className="truncate">{id}</span>
                          <span className="text-gray-500">x{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="border border-gray-800 bg-surface/60 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="text-sm text-gray-300 font-bold">전투 로그</div>
              <div className="text-xs text-gray-600 text-right leading-snug">
                <div>
                  던전 골드{" "}
                  <span className="text-gray-300">{hero.gold}</span>
                  {hero.goldDebt > 0 ? (
                    <span className="text-gray-500"> (상쇄 {hero.goldDebt}G)</span>
                  ) : null}
                </div>
                <div>
                  보유 골드{" "}
                  <span className="text-gray-300">{metaResources.gold}</span>
                </div>
              </div>
            </div>
            <div
              ref={logRef}
              className="h-[260px] overflow-y-auto px-4 py-3 text-sm text-gray-300 font-mono space-y-2"
            >
              {log.map((line, i) => (
                <motion.div
                  key={`${i}-${line}`}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="leading-relaxed"
                >
                  <LogLine line={line} />
                </motion.div>
              ))}
            </div>
          </div>

          <div className="border border-gray-800 bg-surface/60 rounded-lg p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                커맨드
              </div>
              <button
                disabled={!geminiApiKey}
                onClick={() => setAiAdjudication((v) => !v)}
                className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                  !geminiApiKey
                    ? "border-gray-800 text-gray-600 cursor-not-allowed"
                    : aiAdjudication
                      ? "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
                      : "border-gray-800 text-gray-400 hover:text-white hover:border-gray-600"
                }`}
                title={
                  geminiApiKey
                    ? aiAdjudication
                      ? "AI 판정 사용 중"
                      : "AI 판정 꺼짐"
                    : "Gemini API 키가 필요합니다"
                }
              >
                AI 판정: {aiAdjudication ? "ON" : "OFF"}
              </button>
            </div>
            {actionPanel}
          </div>

          {phase === "CLEAR" && (
            <div className="border border-gray-800 bg-surface/60 rounded-lg p-5">
              <div className="flex items-center gap-2 text-gray-200 font-bold">
                <FaTrophy className="text-primary" />
                <span>클리어</span>
              </div>
              <div className="mt-2 text-gray-500">
                정산: 보유 골드 +{" "}
                <span className="text-gray-200">{hero.gold}</span>
              </div>
              <div className="mt-1 text-xs text-gray-600">
                던전에서 얻은 아이템과 강화는 소멸합니다.
              </div>
            </div>
          )}

          {phase === "DEAD" && (
            <div className="border border-gray-800 bg-surface/60 rounded-lg p-5">
              <div className="flex items-center gap-2 text-gray-200 font-bold">
                <FaSkull className="text-red-400" />
                <span>실패</span>
              </div>
              <div className="mt-2 text-gray-500">
                이번 탐험은 끝났습니다.
              </div>
              <div className="mt-1 text-xs text-gray-600">
                정산 없음 (던전 골드{" "}
                <span className="text-gray-300">{hero.gold}</span>
                은 소멸합니다)
              </div>
            </div>
          )}
        </section>
      </motion.main>

      <footer className="border-t border-gray-800 bg-black/20 px-6 py-4 text-xs text-gray-600">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span>AI 텍스트 던전</span>
          {dungeon?.creator_nickname && (
            <span>제작자: {dungeon.creator_nickname}</span>
          )}
        </div>
      </footer>

      <AnimatePresence>
        {phase === "ENTRY" && !entryConfirmed && dungeon && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70" />
            <motion.div
              className="relative w-full max-w-lg border border-gray-800 bg-surface/95 rounded-lg p-6 shadow-2xl"
              initial={{ y: 10, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="text-gray-200 font-bold text-lg">
                던전에 입장하시겠습니까?
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {dungeon.name} · {dungeon.difficulty ?? "NORMAL"} · 방{" "}
                {dungeon.room_count}
              </div>

              <div className="mt-5 grid gap-2 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>지참금</span>
                  <span className="text-gray-200 font-bold">
                    {hero.starterGold}G
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  던전에서 얻은 아이템/버프/강화는 종료 시 소멸합니다.
                  <br />
                  보상은 게임 재화(골드)로만 정산됩니다.
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={confirmEntry}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors"
                >
                  <FaPlay />
                  <span>입장</span>
                </button>
                <button
                  onClick={cancelEntry}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
                >
                  <FaChevronLeft />
                  <span>취소</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded px-2 py-1">
      <div className="text-gray-600">{label}</div>
      <div className="text-gray-200 font-bold">{value}</div>
    </div>
  );
}

function LogLine({ line }: { line: string }) {
  const tokenRe = /([+-]\d+\s*(?:HP|MP)|[+-]\d+\s*G|DC\s*\d+)/g;
  const parts = line.split(tokenRe).filter((p) => p.length > 0);
  const isCrit = line.includes("치명타");

  return (
    <span className={isCrit ? "text-yellow-200 font-bold" : undefined}>
      {parts.map((p, i) => {
        const k = `${i}-${p}`;
        if (/^DC\s*\d+$/i.test(p)) {
          return (
            <span key={k} className="text-gray-400">
              {p}
            </span>
          );
        }
        if (/^[+-]\d+\s*HP$/i.test(p)) {
          const neg = p.trim().startsWith("-");
          return (
            <span key={k} className={neg ? "text-red-300 font-bold" : "text-emerald-300 font-bold"}>
              {p}
            </span>
          );
        }
        if (/^[+-]\d+\s*MP$/i.test(p)) {
          const neg = p.trim().startsWith("-");
          return (
            <span key={k} className={neg ? "text-sky-300 font-bold" : "text-primary font-bold"}>
              {p}
            </span>
          );
        }
        if (/^[+-]\d+\s*G$/i.test(p)) {
          const neg = p.trim().startsWith("-");
          return (
            <span key={k} className={neg ? "text-amber-200 font-bold" : "text-primary font-bold"}>
              {p}
            </span>
          );
        }
        return <span key={k}>{p}</span>;
      })}
    </span>
  );
}
