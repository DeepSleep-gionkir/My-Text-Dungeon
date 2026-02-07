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
import type { CardAction, CardCategory, CardData } from "@/types/card";
import type { Difficulty } from "@/types/builder";
import type { HeroClass } from "@/types/hero";
import type { UserProfile } from "@/types/user";
import CardView from "@/components/card/CardView";
import AppLogoLink from "@/components/app/AppLogoLink";
import { type MetaPassives, useUserStore } from "@/store/useUserStore";
import { deriveHeroCombatStats } from "@/lib/hero";
import { generateGeminiJSON } from "@/lib/gemini";
import {
  CLEAR_REWARD_BY_DIFFICULTY,
  FAILURE_REWARD_BY_DIFFICULTY,
  calcCritChance,
  calcDamage,
  calcFleeChance,
  calcStatusResistChance,
  getFallbackRewardGold,
  getEnemySquadCount,
  getEventChoiceProfile,
  getFallbackConsumableDropChance,
  getGearDropChance,
  getNpcQuestBalance,
  getNpcTalkBalance,
  getShrineTimePenalty,
  getSmithyUpgradeCost,
  getTrapDamageRatio,
  getTraderBasePriceProfile,
  goldFromReward,
  itemsFromReward,
  xpFromCard,
  xpToNext,
  SHRINE_GUARDIAN_STATS,
  START_GOLD_BY_DIFFICULTY,
  TRAP_TRIGGER_RATE,
} from "@/lib/balancing";
import { estimateGearValue, gearBonusText, gearName, getGearDef, isGearItemId } from "@/lib/gear";
import { normalizeCardData } from "@/lib/normalizeCard";
import {
  applyRunTelemetryDelta,
  assessRunRisk,
  createRunTelemetry,
  getAdaptiveConsumableDropBoost,
  summarizeRunTelemetry,
  type RunTelemetry,
  type RunTelemetryDelta,
} from "@/lib/runSystems";
import KeywordIcon from "@/components/keyword/KeywordIcon";
import {
  FaArrowRight,
  FaBolt,
  FaChevronLeft,
  FaCheckCircle,
  FaClipboardList,
  FaCoins,
  FaHandPaper,
  FaHeart,
  FaPlay,
  FaShieldAlt,
  FaSkull,
  FaShoePrints,
  FaTrophy,
  FaUserShield,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { GiTwoCoins } from "react-icons/gi";
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
  rewardGold: number;
  starterGold: number;
  goldDebt: number;
  items: Record<string, number>;
  equipment: {
    weapon: string | null;
    armor: string | null;
    accessory: string | null;
  };
  effects: EffectInstance[];
};

type EnemyState = {
  id: string;
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

type QuestKind = "KILL_ENEMY" | "OPEN_CHEST" | "REACH_END" | "SURVIVE_TURNS";

type QuestState = {
  id: string;
  kind: QuestKind;
  title: string;
  desc: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  reward: { gold: number };
};

const ENABLE_AI_ADJUDICATION =
  process.env.NEXT_PUBLIC_ENABLE_AI_ADJUDICATION !== "0";

const ITEM_DISPLAY_NAME: Record<string, string> = {
  ITEM_POTION_S: "포션 (소형)",
  ITEM_POTION_M: "포션 (중형)",
  ITEM_POTION_L: "포션 (대형)",
  ITEM_SMOKE_BOMB: "연막탄",
  ITEM_SHARPENING_STONE: "숫돌",
  ITEM_ARMOR_PATCH: "수선 키트",
  ITEM_RELIC_SHARD: "유물 조각",
  ITEM_REVIVE_TOKEN: "부활 토큰",
};

function itemDisplayName(id: string): string {
  const key = String(id ?? "").trim().toUpperCase();
  if (!key) return "";
  if (isGearItemId(key)) return gearName(key);
  return ITEM_DISPLAY_NAME[key] ?? key;
}

const GEAR_POOL_BY_DIFFICULTY: Record<Difficulty, string[]> = {
  EASY: [
    "ITEM_WEAPON_DULL_SWORD",
    "ITEM_WEAPON_SIMPLE_DAGGER",
    "ITEM_WEAPON_WOODEN_STAFF",
    "ITEM_WEAPON_LIGHT_BOW",
    "ITEM_WEAPON_HOLY_MACE",
    "ITEM_ARMOR_TORN_CLOAK",
    "ITEM_ACCESSORY_PLAIN_RING",
    "ITEM_WEAPON_RUSTY_DAGGER",
    "ITEM_ARMOR_LEATHER_VEST",
    "ITEM_ACCESSORY_LUCK_CHARM",
    "ITEM_ACCESSORY_SCOUT_WHISTLE",
  ],
  NORMAL: [
    "ITEM_WEAPON_DULL_SWORD",
    "ITEM_WEAPON_SIMPLE_DAGGER",
    "ITEM_WEAPON_WOODEN_STAFF",
    "ITEM_WEAPON_LIGHT_BOW",
    "ITEM_WEAPON_HOLY_MACE",
    "ITEM_ARMOR_TORN_CLOAK",
    "ITEM_ACCESSORY_PLAIN_RING",
    "ITEM_WEAPON_RUSTY_DAGGER",
    "ITEM_WEAPON_IRON_SWORD",
    "ITEM_WEAPON_HUNTER_BOW",
    "ITEM_WEAPON_CRACKED_WAND",
    "ITEM_ARMOR_LEATHER_VEST",
    "ITEM_ARMOR_PADDED_ARMOR",
    "ITEM_ACCESSORY_THIEF_RING",
    "ITEM_ACCESSORY_LUCK_CHARM",
    "ITEM_ACCESSORY_HOLY_BEADS",
    "ITEM_ACCESSORY_SCOUT_WHISTLE",
  ],
  HARD: [
    "ITEM_WEAPON_IRON_SWORD",
    "ITEM_WEAPON_STEEL_SWORD",
    "ITEM_WEAPON_HUNTER_BOW",
    "ITEM_WEAPON_LONGBOW",
    "ITEM_WEAPON_CRACKED_WAND",
    "ITEM_WEAPON_ARCANE_WAND",
    "ITEM_WEAPON_RUSTY_DAGGER",
    "ITEM_WEAPON_SHADOW_DAGGER",
    "ITEM_WEAPON_BLESSED_MACE",
    "ITEM_ARMOR_CHAINMAIL",
    "ITEM_ARMOR_LEATHER_VEST",
    "ITEM_ARMOR_PADDED_ARMOR",
    "ITEM_ARMOR_BLESSED_ROBE",
    "ITEM_ACCESSORY_THIEF_RING",
    "ITEM_ACCESSORY_HOLY_BEADS",
    "ITEM_ACCESSORY_LUCK_CHARM",
    "ITEM_ACCESSORY_FOCUS_TALISMAN",
    "ITEM_ACCESSORY_SCOUT_WHISTLE",
  ],
  NIGHTMARE: [
    "ITEM_WEAPON_STEEL_SWORD",
    "ITEM_WEAPON_SHADOW_DAGGER",
    "ITEM_WEAPON_ARCANE_WAND",
    "ITEM_WEAPON_LONGBOW",
    "ITEM_WEAPON_BLESSED_MACE",
    "ITEM_WEAPON_IRON_SWORD",
    "ITEM_WEAPON_HUNTER_BOW",
    "ITEM_WEAPON_CRACKED_WAND",
    "ITEM_ARMOR_CHAINMAIL",
    "ITEM_ARMOR_PADDED_ARMOR",
    "ITEM_ARMOR_BLESSED_ROBE",
    "ITEM_ACCESSORY_HOLY_BEADS",
    "ITEM_ACCESSORY_THIEF_RING",
    "ITEM_ACCESSORY_LUCK_CHARM",
    "ITEM_ACCESSORY_FOCUS_TALISMAN",
    "ITEM_ACCESSORY_SCOUT_WHISTLE",
  ],
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

type JsonRecord = Record<string, unknown>;
type ParsedEffectAdd = { id: string; turns: number; stacks: number };

function asJsonRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as JsonRecord;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseTrimmedStringArray(value: unknown, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v: unknown): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, maxLen);
}

function parseEffectAdds(value: unknown): ParsedEffectAdd[] {
  if (!Array.isArray(value)) return [];
  const out: ParsedEffectAdd[] = [];
  for (const row of value.slice(0, 4)) {
    const data = asJsonRecord(row);
    if (!data) continue;

    const id = String(data.id ?? "").trim().toUpperCase();
    if (!id.startsWith("STATUS_") && !id.startsWith("BUFF_")) continue;

    const turnsRaw = asFiniteNumber(data.turns);
    const stacksRaw = asFiniteNumber(data.stacks);
    const turns = clamp(
      turnsRaw !== null ? Math.round(turnsRaw) : DEFAULT_EFFECT_TURNS,
      1,
      6,
    );
    const stacks = clamp(
      stacksRaw !== null ? Math.round(stacksRaw) : 1,
      1,
      9,
    );

    out.push({ id, turns, stacks });
  }
  return out;
}

type SfxName = "UI" | "HIT" | "CRIT" | "COIN" | "HEAL" | "DOOR" | "EQUIP";

type SfxController = {
  play: (name: SfxName) => void;
  close: () => void;
};

function createSfx(): SfxController | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;

  const ctx = new AudioContextCtor();
  const master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);

  const ensure = () => {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  };

  const blip = (t0: number, freq: number, dur: number, gain: number, type: OscillatorType) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  };

  const noise = (t0: number, dur: number, gain: number, freq: number) => {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(freq, t0);
    f.Q.setValueAtTime(0.9, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  };

  const play = (name: SfxName) => {
    ensure();
    const t0 = ctx.currentTime;
    if (name === "UI") {
      blip(t0, 920, 0.06, 0.08, "triangle");
      return;
    }
    if (name === "HIT") {
      noise(t0, 0.14, 0.06, 520);
      blip(t0, 110, 0.12, 0.09, "sine");
      return;
    }
    if (name === "CRIT") {
      blip(t0, 1100, 0.14, 0.11, "triangle");
      blip(t0 + 0.05, 880, 0.16, 0.09, "square");
      return;
    }
    if (name === "COIN") {
      blip(t0, 740, 0.12, 0.08, "sine");
      blip(t0 + 0.06, 980, 0.12, 0.07, "sine");
      return;
    }
    if (name === "HEAL") {
      blip(t0, 520, 0.18, 0.06, "triangle");
      blip(t0 + 0.08, 660, 0.18, 0.05, "triangle");
      return;
    }
    if (name === "DOOR") {
      noise(t0, 0.5, 0.05, 220);
      blip(t0, 120, 0.5, 0.05, "sawtooth");
      return;
    }
    if (name === "EQUIP") {
      blip(t0, 640, 0.09, 0.06, "square");
      blip(t0 + 0.04, 880, 0.1, 0.05, "triangle");
    }
  };

  return {
    play,
    close: () => ctx.close().catch(() => {}),
  };
}

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

const CARD_CATEGORY_VALUES: CardCategory[] = [
  "CARD_ENEMY_SINGLE",
  "CARD_ENEMY_SQUAD",
  "CARD_BOSS",
  "CARD_TRAP_INSTANT",
  "CARD_TRAP_ROOM",
  "CARD_LOOT_CHEST",
  "CARD_SHRINE",
  "CARD_EVENT_CHOICE",
  "CARD_NPC_TRADER",
  "CARD_NPC_QUEST",
  "CARD_NPC_TALK",
  "CARD_REST_CAMPFIRE",
  "CARD_REST_SMITHY",
  "CARD_REST_STATUE",
];

const isCardCategory = (v: string): v is CardCategory =>
  CARD_CATEGORY_VALUES.includes(v as CardCategory);

const asDifficulty = (v: unknown): Difficulty => {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (s === "EASY" || s === "NORMAL" || s === "HARD" || s === "NIGHTMARE") return s;
  return "NORMAL";
};

function fallbackRuntimeCard(index: number, difficulty: Difficulty): CardData {
  return normalizeCardData(
    {
      category: "CARD_EVENT_CHOICE",
      name: `손상된 방 ${index + 1}`,
      description: "기록이 손상된 구역입니다. 조심스럽게 지나갑니다.",
      grade: "NORMAL",
      tags: ["TAG_UNKNOWN", "ENV_DUNGEON"],
    },
    "CARD_EVENT_CHOICE",
    difficulty,
  );
}

function sanitizeRuntimeCard(
  value: unknown,
  difficulty: Difficulty,
  index: number,
): CardData {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const categoryRaw = typeof row.category === "string" ? row.category.trim().toUpperCase() : "";
  const forcedCategory: CardCategory = isCardCategory(categoryRaw)
    ? (categoryRaw as CardCategory)
    : "CARD_EVENT_CHOICE";
  const name =
    typeof row.name === "string" && row.name.trim().length > 0
      ? row.name
      : `미확인 구역 ${index + 1}`;
  const description =
    typeof row.description === "string" && row.description.trim().length > 0
      ? row.description
      : "정체를 알 수 없는 기운이 감돕니다.";

  try {
    return normalizeCardData(
      {
        ...row,
        category: forcedCategory,
        name,
        description,
      },
      forcedCategory,
      difficulty,
    );
  } catch {
    return fallbackRuntimeCard(index, difficulty);
  }
}

function normalizeDungeonDoc(raw: DungeonDoc): {
  dungeon: DungeonDoc;
  roomToStep: number[] | null;
  firstStepFork: boolean;
} {
  const docDifficulty = asDifficulty(raw.difficulty);
  const rawStepsV2 = Array.isArray(raw.room_steps_v2) ? raw.room_steps_v2 : null;
  const rawStepsLegacy = Array.isArray(raw.room_steps) ? raw.room_steps : null;

  // Normalize card_list (legacy docs may not have room_steps; some docs may omit card_list).
  const cardsFromSteps: unknown[] = [];
  const indicesByStep: number[][] = [];
  const stepMap: number[] = [];
  let idx = 0;

  if (rawStepsV2) {
    for (let si = 0; si < rawStepsV2.length; si++) {
      const stepDoc = rawStepsV2[si];
      if (!stepDoc || typeof stepDoc !== "object") continue;
      const roomsRaw = (stepDoc as { rooms?: unknown }).rooms;
      const rooms = Array.isArray(roomsRaw) ? roomsRaw.slice(0, 2) : [];
      const cards = rooms.filter((c) => c !== undefined);
      const count = cards.length >= 2 ? 2 : 1;
      if (count === 1) {
        indicesByStep.push([idx]);
        stepMap.push(si);
        cardsFromSteps.push(cards[0] ?? null);
        idx += 1;
      } else {
        indicesByStep.push([idx, idx + 1]);
        stepMap.push(si, si);
        cardsFromSteps.push(cards[0] ?? null);
        cardsFromSteps.push(cards[1] ?? null);
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
        cardsFromSteps.push(step[0] ?? null);
        idx += 1;
      } else {
        indicesByStep.push([idx, idx + 1]);
        stepMap.push(si, si);
        cardsFromSteps.push(step[0] ?? null);
        cardsFromSteps.push(step[1] ?? null);
        idx += 2;
      }
    }
  }

  const rawCards = Array.isArray(raw.card_list) ? raw.card_list : cardsFromSteps;
  const normalizedCards = rawCards.map((card, i) =>
    sanitizeRuntimeCard(card, docDifficulty, i),
  );

  // Guard against malformed or abusive dungeon docs.
  const roomTotalFromDoc =
    typeof raw.room_total === "number" && Number.isFinite(raw.room_total)
      ? Math.round(raw.room_total)
      : normalizedCards.length;
  const room_total = clamp(
    Math.max(roomTotalFromDoc, normalizedCards.length, 1),
    1,
    220,
  );
  const card_list: CardData[] = normalizedCards.slice(0, room_total);
  while (card_list.length < room_total) {
    card_list.push(fallbackRuntimeCard(card_list.length, docDifficulty));
  }
  const safeRoomCount =
    typeof raw.room_count === "number" && Number.isFinite(raw.room_count)
      ? Math.round(clamp(raw.room_count, 1, room_total))
      : Math.max(1, Math.min(room_total, indicesByStep.length || room_total));

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
  const roomToStep: number[] =
    stepMap.length === room_total
      ? stepMap
      : Array.from({ length: room_total }, (_, i) => Math.min(i, safeRoomCount - 1));

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
      difficulty: docDifficulty,
      room_count: safeRoomCount,
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
  const starterWeaponByClass: Record<HeroClass, string> = {
    WARRIOR: "ITEM_WEAPON_DULL_SWORD",
    ROGUE: "ITEM_WEAPON_SIMPLE_DAGGER",
    MAGE: "ITEM_WEAPON_WOODEN_STAFF",
    RANGER: "ITEM_WEAPON_LIGHT_BOW",
    CLERIC: "ITEM_WEAPON_HOLY_MACE",
  };

  const starterWeapon = starterWeaponByClass[heroClass];
  const base: HeroState = {
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
    rewardGold: 0,
    starterGold: Math.max(0, Math.round(starterGold)),
    goldDebt: 0,
    items: { ITEM_POTION_S: 1 + potLv },
    equipment: { weapon: null, armor: null, accessory: null },
    effects: [],
  };

  const w = getGearDef(starterWeapon);
  if (!w) return base;

  const b = w.bonus;
  const maxHp = Math.max(1, base.maxHp + (b.maxHp ?? 0));
  const maxMp = Math.max(0, base.maxMp + (b.maxMp ?? 0));
  const hp = clamp(base.hp + (b.maxHp ?? 0), 0, maxHp);
  const mp = clamp(base.mp + (b.maxMp ?? 0), 0, maxMp);

  return {
    ...base,
    maxHp,
    hp,
    maxMp,
    mp,
    atk: Math.max(1, base.atk + (b.atk ?? 0)),
    def: Math.max(0, base.def + (b.def ?? 0)),
    spd: Math.max(1, base.spd + (b.spd ?? 0)),
    luk: Math.max(0, base.luk + (b.luk ?? 0)),
    items: { ...base.items, [starterWeapon]: 1 },
    equipment: { ...base.equipment, weapon: starterWeapon },
  };
}

function isCombatCard(category: string) {
  return category.includes("ENEMY") || category.includes("BOSS");
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
  const [dungeon] = useState<DungeonDoc | null>(
    () => normalizedInitial?.dungeon ?? null,
  );
  const [error] = useState<string | null>(() => initialError);
  const [entryConfirmed, setEntryConfirmed] = useState(false);

  const [roomIndex, setRoomIndex] = useState(0);
  const [pendingFork, setPendingFork] = useState<[number, number] | null>(() =>
    normalizedInitial?.firstStepFork ? [0, 1] : null,
  );
  const [roomToStep] = useState<number[] | null>(
    () => normalizedInitial?.roomToStep ?? null,
  );
  const [hero, setHero] = useState<HeroState>(() =>
    buildHero(metaStats, effectiveHeroClass, metaPassives, starterGold),
  );

  const [enemies, setEnemies] = useState<EnemyState[]>([]);
  const [targetEnemyId, setTargetEnemyId] = useState<string | null>(null);
  const [turn, setTurn] = useState<"PLAYER" | "ENEMY">("PLAYER");
  const [defending, setDefending] = useState(false);
  const [rogueFirstStrike, setRogueFirstStrike] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [levelUpPending, setLevelUpPending] = useState(0);
  const [levelUpChoices, setLevelUpChoices] = useState<
    Array<{ id: LevelUpChoiceId; label: string }>
  >([]);
  const [pendingShrineOption, setPendingShrineOption] = useState<
    NonNullable<CardData["options"]>[number] | null
  >(null);
  const [trapArmed, setTrapArmed] = useState(false);
  const [quests, setQuests] = useState<QuestState[]>([]);
  const [npcTalk, setNpcTalk] = useState<{
    lines: string[];
    idx: number;
    reward: { xp: number; gold: number } | null;
  } | null>(null);
  const [heroHitTick, setHeroHitTick] = useState(0);
  const [enemyHitTick, setEnemyHitTick] = useState(0);
  const [heroFlash, setHeroFlash] = useState(false);
  const [enemyFlash, setEnemyFlash] = useState(false);
  const [settled, setSettled] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [runTelemetry, setRunTelemetry] = useState<RunTelemetry>(() =>
    createRunTelemetry(),
  );

  const [log, setLog] = useState<string[]>(() =>
    normalizedInitial?.dungeon
      ? [`입장 확인: ${normalizedInitial.dungeon.name}`, `지참금: ${starterGold}G`]
      : [],
  );
  const [typing, setTyping] = useState<{ index: number; pos: number } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const shakeControls = useAnimationControls();
  const sfxRef = useRef<SfxController | null>(null);
  const sfxEnabledRef = useRef<boolean>(sfxEnabled);
  const runAnalyticsCommittedRef = useRef(false);

  const currentCard = dungeon?.card_list?.[roomIndex] ?? null;
  const totalRooms =
    dungeon?.room_total ?? dungeon?.card_list?.length ?? dungeon?.room_count ?? 0;
  const progressStepIndex = dungeon ? (roomToStep?.[roomIndex] ?? roomIndex) : 0;
  const roomLabel = dungeon ? `${progressStepIndex + 1} / ${dungeon.room_count}` : "";
  const progressRatio =
    dungeon && dungeon.room_count > 0
      ? clamp((progressStepIndex + 1) / dungeon.room_count, 0, 1)
      : 0;
  const potionCountTotal = useMemo(
    () =>
      Object.entries(hero.items)
        .filter(([id]) => id.startsWith("ITEM_POTION"))
        .reduce(
          (acc, [, n]) =>
            acc + (typeof n === "number" && Number.isFinite(n) ? n : 0),
          0,
        ),
    [hero.items],
  );
  const difficulty: Difficulty = dungeon?.difficulty ?? "NORMAL";
  const clearRewardPreview = dungeon
    ? Math.max(0, Math.round(CLEAR_REWARD_BY_DIFFICULTY[difficulty] + hero.rewardGold - hero.goldDebt))
    : 0;
  const failRewardPreview = dungeon
    ? Math.max(0, Math.round(FAILURE_REWARD_BY_DIFFICULTY[difficulty]))
    : 0;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    sfxEnabledRef.current = sfxEnabled;
  }, [sfxEnabled]);

  useEffect(() => {
    return () => {
      sfxRef.current?.close();
      sfxRef.current = null;
    };
  }, []);

  const playSfx = (name: SfxName) => {
    if (!sfxEnabledRef.current) return;
    if (!sfxRef.current) sfxRef.current = createSfx();
    sfxRef.current?.play(name);
  };

  useEffect(() => {
    if (log.length === 0) return;
    const index = log.length - 1;
    const text = log[index] ?? "";

    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    setTyping({ index, pos: 0 });
    if (!text) return;

    const step = clamp(Math.round(text.length / 48), 1, 4);
    typingTimerRef.current = window.setInterval(() => {
      setTyping((t) => {
        if (!t || t.index !== index) return { index, pos: 0 };
        const nextPos = Math.min(text.length, t.pos + step);
        if (nextPos >= text.length) {
          if (typingTimerRef.current) {
            window.clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
        }
        return { ...t, pos: nextPos };
      });
    }, 14);

    return () => {
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [log]);

  const skipTyping = () => {
    setTyping((t) => {
      if (!t) return t;
      const full = log[t.index]?.length ?? t.pos;
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      return { ...t, pos: full };
    });
  };

  useEffect(() => {
    if (heroHitTick <= 0) return;
    setHeroFlash(true);
    const t = window.setTimeout(() => setHeroFlash(false), 160);
    return () => window.clearTimeout(t);
  }, [heroHitTick]);

  useEffect(() => {
    if (enemyHitTick <= 0) return;
    setEnemyFlash(true);
    const t = window.setTimeout(() => setEnemyFlash(false), 160);
    return () => window.clearTimeout(t);
  }, [enemyHitTick]);

  const heroRef = useRef<HeroState>(hero);
  useEffect(() => {
    heroRef.current = hero;
  }, [hero]);

  const enemiesRef = useRef<EnemyState[]>(enemies);
  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

  const aliveEnemies = useMemo(() => enemies.filter((e) => e.hp > 0), [enemies]);
  const targetEnemy = useMemo(() => {
    if (aliveEnemies.length === 0) return null;
    if (targetEnemyId) {
      const found = aliveEnemies.find((e) => e.id === targetEnemyId);
      if (found) return found;
    }
    return aliveEnemies[0] ?? null;
  }, [aliveEnemies, targetEnemyId]);
  const enemyHpTotal = useMemo(
    () => enemies.reduce((acc, e) => acc + Math.max(0, e.hp), 0),
    [enemies],
  );
  const enemyMaxHpTotal = useMemo(
    () => enemies.reduce((acc, e) => acc + Math.max(0, e.maxHp), 0),
    [enemies],
  );
  const riskState = useMemo(
    () =>
      assessRunRisk({
        hp: hero.hp,
        maxHp: hero.maxHp,
        mp: hero.mp,
        maxMp: hero.maxMp,
        effectsCount: hero.effects.length,
        goldDebt: hero.goldDebt,
        starterGold: Math.max(1, hero.starterGold),
        potionCount: potionCountTotal,
        progressRatio,
        inCombat: phase === "COMBAT" && aliveEnemies.length > 0,
        enemyPressure:
          phase === "COMBAT" && enemyMaxHpTotal > 0
            ? clamp(enemyHpTotal / enemyMaxHpTotal, 0, 1)
            : 0,
      }),
    [
      aliveEnemies.length,
      enemyHpTotal,
      enemyMaxHpTotal,
      hero.effects.length,
      hero.goldDebt,
      hero.hp,
      hero.maxHp,
      hero.maxMp,
      hero.mp,
      hero.starterGold,
      phase,
      potionCountTotal,
      progressRatio,
    ],
  );
  const runSummary = useMemo(
    () =>
      summarizeRunTelemetry(runTelemetry, {
        outcome: phase === "CLEAR" ? "CLEAR" : "DEAD",
        finalRoom: progressStepIndex + (phase === "CLEAR" ? 1 : 0),
        totalRooms: Math.max(1, dungeon?.room_count ?? totalRooms),
      }),
    [runTelemetry, phase, progressStepIndex, dungeon?.room_count, totalRooms],
  );

  useEffect(() => {
    if (!dungeonId || !dungeon) return;
    if (!entryConfirmed) return;
    if (phase !== "CLEAR" && phase !== "DEAD") return;
    if (runAnalyticsCommittedRef.current) return;
    runAnalyticsCommittedRef.current = true;

    const outcome = phase === "CLEAR" ? "CLEAR" : "DEAD";
    const finalRoom =
      outcome === "CLEAR"
        ? Math.max(1, dungeon.room_count)
        : clamp(progressStepIndex + 1, 0, Math.max(1, dungeon.room_count));
    const summary = summarizeRunTelemetry(runTelemetry, {
      outcome,
      finalRoom,
      totalRooms: Math.max(1, dungeon.room_count),
    });

    const payload: Record<string, unknown> = {
      balance_runs: increment(1),
      balance_total_progress_rate: increment(summary.roomProgressRate),
      balance_total_duration_sec: increment(summary.durationSec),
      balance_total_turns: increment(Math.max(0, runTelemetry.turnsTaken)),
      balance_total_damage_dealt: increment(Math.max(0, runTelemetry.damageDealt)),
      balance_total_damage_taken: increment(Math.max(0, runTelemetry.damageTaken)),
      balance_total_combats: increment(Math.max(0, runTelemetry.combatsStarted)),
      balance_total_combat_wins: increment(Math.max(0, runTelemetry.combatsWon)),
      balance_total_events: increment(Math.max(0, runTelemetry.eventsResolved)),
      balance_total_event_success: increment(Math.max(0, runTelemetry.eventSuccess)),
      balance_total_flee_attempts: increment(Math.max(0, runTelemetry.fleeAttempts)),
      balance_total_flee_success: increment(Math.max(0, runTelemetry.fleeSuccess)),
      balance_last_outcome: outcome,
      balance_last_updated_at: serverTimestamp(),
    };
    if (outcome === "CLEAR") payload.balance_clear_count = increment(1);
    else payload.balance_fail_count = increment(1);

    updateDoc(doc(db, "dungeons", dungeonId), payload).catch(() => {
      runAnalyticsCommittedRef.current = false;
    });
  }, [dungeon, dungeonId, entryConfirmed, phase, progressStepIndex, runTelemetry]);

  const riskToneClass =
    riskState.tone === "CRITICAL"
      ? "text-red-300"
      : riskState.tone === "DANGER"
        ? "text-orange-300"
        : riskState.tone === "CAUTION"
          ? "text-yellow-200"
          : "text-emerald-300";
  const riskBarClass =
    riskState.tone === "CRITICAL"
      ? "bg-red-500/80"
      : riskState.tone === "DANGER"
        ? "bg-orange-500/80"
        : riskState.tone === "CAUTION"
          ? "bg-yellow-500/80"
          : "bg-emerald-500/80";

  useEffect(() => {
    if (phase !== "COMBAT") return;
    if (aliveEnemies.length === 0) return;
    if (targetEnemyId && aliveEnemies.some((e) => e.id === targetEnemyId)) return;
    setTargetEnemyId(aliveEnemies[0]!.id);
  }, [phase, aliveEnemies, targetEnemyId]);

  const appendLog = (line: string) => {
    setLog((prev) => [...prev, line].slice(-200));
  };

  const pushRunTelemetry = (delta: RunTelemetryDelta) => {
    setRunTelemetry((prev) => applyRunTelemetryDelta(prev, delta));
  };

  const incrementQuest = (kind: QuestKind, delta = 1) => {
    if (delta <= 0) return;
    setQuests((prev) =>
      prev.map((q) => {
        if (q.kind !== kind || q.claimed) return q;
        if (q.completed) return q;
        const progress = Math.min(q.target, q.progress + delta);
        const completed = progress >= q.target;
        return { ...q, progress, completed };
      }),
    );
  };

  const claimQuest = (questId: string) => {
    const q = quests.find((x) => x.id === questId);
    if (!q || !q.completed || q.claimed) return;
    pushRunTelemetry({ questsClaimed: 1 });
    const rewardGold = Math.max(0, Math.round(q.reward.gold));
    setQuests((prev) =>
      prev.map((x) => (x.id === questId ? { ...x, claimed: true } : x)),
    );
    if (rewardGold > 0) {
      // Same settlement rule: quest rewards are dungeon gold.
      const debt = hero.goldDebt;
      const paid = Math.min(debt, rewardGold);
      const earned = rewardGold - paid;
      if (paid > 0) pushRunTelemetry({ debtPaid: paid });
      if (earned > 0) pushRunTelemetry({ goldEarned: earned });
      if (paid > 0) appendLog(`의뢰 보상 상쇄: -${paid}G`);
      if (earned > 0) {
        appendLog(`의뢰 보상: +${earned}G`);
        playSfx("COIN");
      }
      setHero((h) => ({
        ...h,
        goldDebt: Math.max(0, h.goldDebt - paid),
        gold: h.gold + earned,
        rewardGold: h.rewardGold + earned,
      }));
    }
    appendLog(`의뢰 완료 보상을 수령했습니다: ${q.title}`);
  };

  const offerNpcQuests = () => {
    if (!dungeon) return;
    const remaining = (dungeon.card_list ?? []).slice(roomIndex + 1);
    const remainingCombats = remaining.filter((c) => c && isCombatCard(c.category));
    const remainingChests = remaining.filter((c) => c && c.category === "CARD_LOOT_CHEST");

    const diff = dungeon.difficulty ?? "NORMAL";
    const questBalance = getNpcQuestBalance(diff);
    const rewardBase = questBalance.rewardBaseGold;

    const makeId = (suffix: string) =>
      `${Date.now()}-${Math.random().toString(16).slice(2)}-${suffix}`;

    setQuests((prev) => {
      const hasKind = (k: QuestKind) => prev.some((q) => q.kind === k && !q.claimed);
      const next: QuestState[] = prev.slice();

      if (!hasKind("OPEN_CHEST") && remainingChests.length > 0) {
        next.push({
          id: makeId("CHEST"),
          kind: "OPEN_CHEST",
          title: "보물 회수",
          desc: "남은 던전에서 보물 상자를 1개 열어 보상을 받는다.",
          progress: 0,
          target: 1,
          completed: false,
          claimed: false,
          reward: { gold: Math.round(rewardBase * questBalance.chestRewardMultiplier) },
        });
      }

      if (!hasKind("KILL_ENEMY") && remainingCombats.length > 0) {
        const target = questBalance.killTarget;
        next.push({
          id: makeId("KILL"),
          kind: "KILL_ENEMY",
          title: "토벌 의뢰",
          desc: `남은 던전에서 적을 ${Math.min(target, remainingCombats.length)}번 처치한다.`,
          progress: 0,
          target: Math.min(target, remainingCombats.length),
          completed: false,
          claimed: false,
          reward: { gold: Math.round(rewardBase * questBalance.killRewardMultiplier) },
        });
      }

      if (!hasKind("REACH_END") && roomIndex + 1 < totalRooms) {
        next.push({
          id: makeId("END"),
          kind: "REACH_END",
          title: "귀환 보고",
          desc: "던전의 끝까지 도달해 보고한다.",
          progress: 0,
          target: 1,
          completed: false,
          claimed: false,
          reward: { gold: Math.round(rewardBase * questBalance.reachEndRewardMultiplier) },
        });
      }

      return next.slice(0, 12);
    });

    appendLog("의뢰인이 다음 구역을 훑어봅니다...");
    appendLog("새 의뢰가 등록되었습니다. (오른쪽 '의뢰' 패널 확인)");
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
    playSfx("DOOR");
    runAnalyticsCommittedRef.current = false;
    setRunTelemetry(createRunTelemetry());
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

  const canUseAI = Boolean(geminiApiKey) && ENABLE_AI_ADJUDICATION;

  const attemptTrap = async (
    kind: "DODGE" | "DISARM" | "ENDURE",
    dc: number,
    trapDmg: number,
  ) => {
    if (!currentCard) return;
    if (aiBusy) return;
    playSfx("UI");
    pushRunTelemetry({ trapAttempts: 1 });

    const roll = (stat: number, bonus = 0) =>
      randInt(1, 20) + Math.floor((stat - 10) / 2) + Math.round(bonus);

    const local = () => {
      const inflict = ATTR_INFLICTS_STATUS.find((x) =>
        (currentCard.tags ?? []).includes(x.attr),
      );
      const willInflict =
        Boolean(inflict) && Math.random() <= clamp((inflict!.chance ?? 0.3) + 0.15, 0, 0.95);

      if (kind === "ENDURE") {
        const reduced = Math.max(1, Math.round(trapDmg * 0.6));
        appendLog(`버티기: -${reduced} HP`);
        if (willInflict && inflict) appendLog(`이상 상태: ${effectLabel(inflict.status)}`);
        pushRunTelemetry({ damageTaken: reduced });
        setHero((h) => {
          const nextHp = Math.max(0, h.hp - reduced);
          const nextEffects = willInflict && inflict
            ? upsertEffect(h.effects, inflict.status, { turns: DEFAULT_EFFECT_TURNS })
            : h.effects;
          return { ...h, hp: nextHp, effects: nextEffects };
        });
        playSfx("HIT");
        setHeroHitTick((t) => t + 1);
        if (hero.hp - reduced <= 0) endRunDead();
        else finishEncounter(currentCard);
        return;
      }

      const isDisarm = kind === "DISARM";
      const rogueBonus = isDisarm && effectiveHeroClass === "ROGUE" ? 4 : 0;
      const stat = isDisarm ? hero.luk : hero.spd;
      const r = roll(stat, rogueBonus);
      appendLog(`${isDisarm ? "해제" : "통과"} 판정: ${r} vs DC ${dc}`);
      if (r >= dc) {
        appendLog(isDisarm ? "해제 성공" : "안전하게 통과합니다.");
        if (isDisarm) pushRunTelemetry({ trapsDisarmed: 1 });
        finishEncounter(currentCard);
        return;
      }
      appendLog(`함정 피해: -${trapDmg} HP`);
      if (willInflict && inflict) appendLog(`이상 상태: ${effectLabel(inflict.status)}`);
      pushRunTelemetry({ damageTaken: trapDmg });
      setHero((h) => {
        const nextHp = Math.max(0, h.hp - trapDmg);
        const nextEffects = willInflict && inflict
          ? upsertEffect(h.effects, inflict.status, { turns: DEFAULT_EFFECT_TURNS })
          : h.effects;
        return { ...h, hp: nextHp, effects: nextEffects };
      });
      playSfx("HIT");
      setHeroHitTick((t) => t + 1);
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
  - kind: "${kind}"  // DODGE=통과, DISARM=해제, ENDURE=버티기

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
      const rawData = asJsonRecord(raw) ?? {};
      const success = Boolean(rawData.success);
      const logLines = parseTrimmedStringArray(rawData.log, 3);

      const hpDamageRaw = asFiniteNumber(rawData.hp_damage);
      const hpDamage = clamp(
        hpDamageRaw !== null
          ? Math.round(hpDamageRaw)
          : kind === "ENDURE"
            ? Math.max(1, Math.round(trapDmg * 0.6))
            : success
              ? 0
              : trapDmg,
        0,
        Math.max(1, Math.round(trapDmg * 2)),
      );

      const goldDeltaRaw = asFiniteNumber(rawData.gold_delta);
      const goldDelta = clamp(
        goldDeltaRaw !== null ? Math.round(goldDeltaRaw) : 0,
        -60,
        120,
      );

      const effectsAdd = parseEffectAdds(rawData.effects_add);
      if (kind === "DISARM" && success) pushRunTelemetry({ trapsDisarmed: 1 });
      if (hpDamage > 0) pushRunTelemetry({ damageTaken: hpDamage });
      if (goldDelta > 0) pushRunTelemetry({ goldEarned: goldDelta });

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
          rewardGold: Math.max(0, h.rewardGold + goldDelta),
          effects: nextEffects,
        };
      });

      if (hpDamage > 0) {
        appendLog(`피해: -${hpDamage} HP`);
        setHeroHitTick((t) => t + 1);
      }
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

  const resolveEventChoice = async (choice: { kind: "APPROACH" | "INVESTIGATE" | "IGNORE"; label: string }) => {
    if (!currentCard) return;
    if (currentCard.category !== "CARD_EVENT_CHOICE") return;
    if (aiBusy) return;
    playSfx("UI");
    pushRunTelemetry({ eventsResolved: 1 });

    const local = () => {
      const diff = dungeon?.difficulty ?? "NORMAL";
      const profile = getEventChoiceProfile(
        diff,
        typeof currentCard.check_info?.difficulty === "number" &&
          Number.isFinite(currentCard.check_info.difficulty)
          ? currentCard.check_info.difficulty
          : null,
      );
      const mod = Math.floor((hero.luk - 10) / 2);
      const r = randInt(1, 20) + mod;
      appendLog(`${choice.label}`);
      appendLog(`판정: ${r} vs DC ${profile.dc}`);

      if (r >= profile.dc) {
        const gold = profile.successGold;
        pushRunTelemetry({ eventSuccess: 1, goldEarned: gold });
        appendLog("좋은 결과입니다.");
        setHero((h) => ({
          ...h,
          gold: h.gold + gold,
          rewardGold: h.rewardGold + gold,
        }));
        appendLog(`획득: +${gold}G`);
        playSfx("COIN");
      } else {
        const dmg = Math.max(1, Math.round(hero.maxHp * profile.failHpRatio));
        pushRunTelemetry({ damageTaken: dmg });
        appendLog("좋지 않은 결과입니다.");
        appendLog(`피해: -${dmg} HP`);
        setHero((h) => ({ ...h, hp: Math.max(0, h.hp - dmg) }));
        setHeroHitTick((t) => t + 1);
        playSfx("HIT");
        if (hero.hp - dmg <= 0) {
          endRunDead();
          return;
        }
      }

      finishEncounter(currentCard);
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

You will judge the outcome of an EVENT choice.

CONTEXT:
- difficulty: ${diff}
- event_card: ${JSON.stringify({
        name: currentCard.name,
        description: currentCard.description,
        tags: currentCard.tags ?? [],
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
- choice: ${JSON.stringify(choice)}

RETURN JSON SCHEMA:
{
  "log": string[],
  "hp_delta": number,
  "mp_delta": number,
  "gold_delta": number,
  "effects_add": { "id": string, "turns": number, "stacks": number }[],
  "items_add": string[]
}

RULES:
- "log" length must be 1..4 (short lines).
- hp_delta/mp_delta/gold_delta must be integers.
- hp_delta range: -${Math.max(1, Math.round(hero.maxHp * 0.35))}..${Math.max(1, Math.round(hero.maxHp * 0.25))}
- mp_delta range: -30..30
- gold_delta range: -80..160
- items_add length: 0..3, each item id must start with "ITEM_".
- effects_add ids must start with "STATUS_" or "BUFF_". turns 1..6, stacks 1..9.
- Outcome should feel fair for the chosen difficulty and hero stats.`;

      const raw = await generateGeminiJSON(geminiApiKey!, prompt);
      const rawData = asJsonRecord(raw) ?? {};
      const logLines = parseTrimmedStringArray(rawData.log, 4);

      const hpDeltaRaw = asFiniteNumber(rawData.hp_delta);
      const hpDelta = clamp(
        hpDeltaRaw !== null ? Math.round(hpDeltaRaw) : 0,
        -Math.max(1, Math.round(hero.maxHp * 0.35)),
        Math.max(1, Math.round(hero.maxHp * 0.25)),
      );

      const mpDeltaRaw = asFiniteNumber(rawData.mp_delta);
      const mpDelta = clamp(
        mpDeltaRaw !== null ? Math.round(mpDeltaRaw) : 0,
        -30,
        30,
      );

      const goldDeltaRaw = asFiniteNumber(rawData.gold_delta);
      const goldDelta = clamp(
        goldDeltaRaw !== null ? Math.round(goldDeltaRaw) : 0,
        -80,
        160,
      );

      const itemsRaw = rawData.items_add;
      const items = Array.isArray(itemsRaw) ? itemsRaw.slice(0, 3) : [];
      const itemsAdd: string[] = [];
      for (const it of items) {
        const id = String(it ?? "").trim().toUpperCase();
        if (!id.startsWith("ITEM_")) continue;
        itemsAdd.push(id);
      }

      const effectsAdd = parseEffectAdds(rawData.effects_add);
      const eventSucceeded =
        hpDelta >= 0 || goldDelta > 0 || itemsAdd.length > 0 || effectsAdd.length > 0;
      if (eventSucceeded) pushRunTelemetry({ eventSuccess: 1 });
      if (goldDelta > 0) pushRunTelemetry({ goldEarned: goldDelta });
      if (hpDelta < 0) pushRunTelemetry({ damageTaken: -hpDelta });
      if (mpDelta > 0) pushRunTelemetry({ mpRecovered: mpDelta });
      if (hpDelta > 0) pushRunTelemetry({ hpRecovered: hpDelta });
      if (itemsAdd.length > 0) pushRunTelemetry({ itemsEarned: itemsAdd.length });

      for (const line of logLines.length ? logLines : ["판정이 내려집니다."]) {
        appendLog(line);
      }

      setHero((h) => {
        const nextHp = clamp(h.hp + hpDelta, 0, h.maxHp);
        const nextMp = clamp(h.mp + mpDelta, 0, h.maxMp);
        const nextGold = Math.max(0, h.gold + goldDelta);
        const nextRewardGold = Math.max(0, h.rewardGold + goldDelta);

        let nextEffects = h.effects;
        for (const ef of effectsAdd) {
          nextEffects = upsertEffect(nextEffects, ef.id, {
            turns: ef.turns,
            stacks: ef.stacks,
          });
        }

        const nextItems = { ...h.items };
        for (const id of itemsAdd) nextItems[id] = (nextItems[id] ?? 0) + 1;

        return {
          ...h,
          hp: nextHp,
          mp: nextMp,
          gold: nextGold,
          rewardGold: nextRewardGold,
          effects: nextEffects,
          items: nextItems,
        };
      });

      if (hpDelta !== 0) {
        appendLog(`HP 변화: ${hpDelta > 0 ? "+" : ""}${hpDelta} HP`);
        if (hpDelta < 0) setHeroHitTick((t) => t + 1);
      }
      if (mpDelta !== 0) appendLog(`MP 변화: ${mpDelta > 0 ? "+" : ""}${mpDelta} MP`);
      if (goldDelta !== 0) appendLog(`골드 변화: ${goldDelta > 0 ? "+" : ""}${goldDelta}G`);
      if (itemsAdd.length) appendLog(`아이템 획득: ${itemsAdd.join(", ")}`);
      if (goldDelta > 0) playSfx("COIN");
      if (hpDelta < 0) playSfx("HIT");
      else if (hpDelta > 0) playSfx("HEAL");

      if (hero.hp + hpDelta <= 0) {
        endRunDead();
        return;
      }

      finishEncounter(currentCard);
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
        pushRunTelemetry({ goldSpent: Math.max(0, Math.round(costNumber)) });
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
        const n = getShrineTimePenalty(
          dungeon?.difficulty ?? "NORMAL",
          typeof opt.cost_value === "number" && Number.isFinite(opt.cost_value)
            ? opt.cost_value
            : null,
        );
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
        const hpGain = Math.max(0, hero.maxHp - hero.hp);
        const mpGain = Math.max(0, hero.maxMp - hero.mp);
        if (hpGain > 0 || mpGain > 0)
          pushRunTelemetry({ hpRecovered: hpGain, mpRecovered: mpGain });
        setHero((h) => ({ ...h, hp: h.maxHp, mp: h.maxMp }));
        appendLog("완전 회복");
      } else if (rewardType === "GAIN_GOLD" && rewardNumber !== null) {
        const add = Math.max(0, Math.round(rewardNumber));
        if (add > 0) pushRunTelemetry({ goldEarned: add });
        setHero((h) => {
          return { ...h, gold: h.gold + add, rewardGold: h.rewardGold + add };
        });
        appendLog(shrineRewardLabel(rewardType, rewardNumber));
      } else if (rewardType === "GAIN_ITEM") {
        const id =
          typeof opt.reward_value === "string" ? opt.reward_value : "ITEM_POTION_S";
        pushRunTelemetry({ itemsEarned: 1 });
        setHero((h) => {
          const nextItems = { ...h.items };
          nextItems[id] = (nextItems[id] ?? 0) + 1;
          return { ...h, items: nextItems };
        });
        appendLog(shrineRewardLabel(rewardType, opt.reward_value));
      } else if (rewardType === "GAIN_RELIC_SHARD") {
        pushRunTelemetry({ itemsEarned: 1 });
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
        pushRunTelemetry({ itemsEarned: 1 });
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
    setEnemies([]);
    setTargetEnemyId(null);
    setTurn("PLAYER");
    setPhase("ENCOUNTER");
    setPendingShrineOption(null);
    setTrapArmed(false);
    setNpcTalk(null);
    setHeroFlash(false);
    setEnemyFlash(false);

    pushRunTelemetry({ roomsVisited: 1 });
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
      pushRunTelemetry({ trapsTriggered: 1 });
      const dmgBase = getTrapDamageRatio(diff, progressRatio);
      const trapDmg = Math.max(1, Math.round(hero.maxHp * dmgBase));

      if (currentCard.category === "CARD_TRAP_INSTANT") {
        appendLog("발밑에서 딸깍 소리가 납니다.");
        appendLog("함정이 즉시 발동합니다.");

        const inflict = ATTR_INFLICTS_STATUS.find((x) =>
          (currentCard.tags ?? []).includes(x.attr),
        );
        if (inflict) appendLog(`이상 상태: ${effectLabel(inflict.status)}`);
        pushRunTelemetry({ damageTaken: trapDmg });

        setHero((h) => {
          const nextHp = Math.max(0, h.hp - trapDmg);
          const nextEffects = inflict
            ? upsertEffect(h.effects, inflict.status, { turns: DEFAULT_EFFECT_TURNS })
            : h.effects;
          return { ...h, hp: nextHp, effects: nextEffects };
        });
        setHeroHitTick((t) => t + 1);

        if (hero.hp - trapDmg <= 0) {
          endRunDead();
          return;
        }
        finishEncounter(currentCard);
        return;
      }

      // Room trap: player can attempt to disable/avoid BEFORE it triggers.
      setTrapArmed(true);
      appendLog("바닥에 장치가 숨겨져 있습니다. 조심해야 합니다.");
    }

    if (currentCard.category === "CARD_NPC_QUEST") {
      appendLog("의뢰인이 당신을 붙잡습니다.");
      offerNpcQuests();
      setPhase("RESOLVED");
      return;
    }

    if (isCombatCard(currentCard.category)) {
      pushRunTelemetry({ combatsStarted: 1 });
      const s = currentCard.stats!;
      const diff = dungeon.difficulty ?? "NORMAL";
      const isSquad = currentCard.category === "CARD_ENEMY_SQUAD";
      const count = isSquad ? getEnemySquadCount(diff) : 1;

      const baseName = currentCard.name;
      const totalHp = Math.max(1, Math.round(s.hp));
      const baseAtk = Math.max(1, Math.round(s.atk));
      const baseDef = Math.max(0, Math.round(s.def));
      const baseSpd = Math.max(1, Math.round(s.spd));

      const party: EnemyState[] = [];
      for (let i = 0; i < count; i++) {
        // Squad stats are distributed across multiple units to enable targeting.
        const hp = isSquad
          ? Math.max(1, Math.round((totalHp / count) * (0.9 + Math.random() * 0.2)))
          : totalHp;
        // Squads act multiple times per round, so each unit must be noticeably weaker.
        const atk = isSquad ? Math.max(1, Math.round(baseAtk * 0.62)) : baseAtk;
        const def = isSquad ? Math.max(0, Math.round(baseDef * 0.82)) : baseDef;
        const spd = isSquad
          ? Math.max(1, Math.round(baseSpd * (0.95 + Math.random() * 0.1)))
          : baseSpd;
        party.push({
          id: `E${i + 1}`,
          name: isSquad ? `${baseName} ${i + 1}` : baseName,
          maxHp: hp,
          hp,
          atk,
          def,
          spd,
          tags: currentCard.tags ?? [],
          actions: currentCard.actions,
          effects: [],
        });
      }
      if (isSquad) {
        // Normalize total HP so the fight roughly matches the card's intended toughness.
        const sum = party.reduce((acc, e) => acc + e.maxHp, 0);
        const ratio = sum > 0 ? totalHp / sum : 1;
        for (const e of party) {
          const next = Math.max(1, Math.round(e.maxHp * ratio));
          e.maxHp = next;
          e.hp = next;
        }
      }
      setEnemies(party);
      setTargetEnemyId(party[0]?.id ?? null);
      setPhase("COMBAT");

      // Initiative: simple SPD check
      if (effectiveHeroClass === "ROGUE") {
        setRogueFirstStrike(true);
        setTurn("PLAYER");
        appendLog("그림자 속에서 선공을 잡습니다.");
      } else {
        const enemySpd = party.reduce((m, e) => Math.max(m, e.spd), 0);
        const playerFirst = hero.spd + randInt(0, 4) >= enemySpd + randInt(0, 4);
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
      onClick={() => {
        playSfx("UI");
        onClick();
      }}
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
    setEnemies([]);
    setTargetEnemyId(null);
    setDefending(false);
    setTurn("PLAYER");

    if (link === null) {
      setPhase("CLEAR");
      appendLog("던전을 클리어했습니다.");
      incrementQuest("REACH_END", 1);
      const diff = dungeon?.difficulty ?? "NORMAL";
      const base = CLEAR_REWARD_BY_DIFFICULTY[diff];
      const earnedGold = Math.max(0, Math.round(base + hero.rewardGold - hero.goldDebt));

      if (!settled && uid && earnedGold > 0) {
        setSettled(true);
        addResources({ gold: earnedGold });
        updateDoc(doc(db, "users", uid), {
          "resources.gold": increment(earnedGold),
          lastClearAt: serverTimestamp(),
        }).catch(() => {});
        appendLog(`정산: 보유 골드 +${earnedGold}G`);
        playSfx("COIN");
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

  const nextRoomHint = () => {
    if (!dungeon) return null;
    const links = normalizeRoomLinks(dungeon.room_links, totalRooms);
    const link = links[roomIndex] ?? null;
    const labelFor = (c: CardData | null) => {
      if (!c) return "알 수 없음";
      if (c.category.includes("BOSS")) return "보스";
      if (c.category.includes("ENEMY")) return "전투";
      if (c.category.includes("TRAP")) return "함정";
      if (c.category.includes("LOOT")) return "보물";
      if (c.category.includes("SHRINE")) return "제단";
      if (c.category.includes("REST")) return "휴식";
      if (c.category.includes("NPC")) return "NPC";
      if (c.category.includes("EVENT")) return "이벤트";
      return "알 수 없음";
    };

    if (link === null) return "끝이 가까워 보입니다.";
    if (Array.isArray(link)) {
      const a = dungeon.card_list?.[link[0]] ?? null;
      const b = dungeon.card_list?.[link[1]] ?? null;
      return `힌트: 왼쪽은 ${labelFor(a)}, 오른쪽은 ${labelFor(b)} 느낌입니다.`;
    }
    const next = dungeon.card_list?.[link] ?? null;
    return `힌트: 다음 방은 ${labelFor(next)}의 기운이 납니다.`;
  };

  const applyGearBonus = (h: HeroState, bonus: Record<string, unknown>, sign: 1 | -1) => {
    type GearBonusKey = "atk" | "def" | "spd" | "luk" | "maxHp" | "maxMp";
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
    const bonusTable = bonus as Partial<Record<GearBonusKey, unknown>>;
    const delta = (k: GearBonusKey) => num(bonusTable[k]) * sign;

    const maxHp = Math.max(1, h.maxHp + delta("maxHp"));
    const maxMp = Math.max(0, h.maxMp + delta("maxMp"));
    const hp = clamp(h.hp + delta("maxHp"), 0, maxHp);
    const mp = clamp(h.mp + delta("maxMp"), 0, maxMp);

    return {
      ...h,
      atk: Math.max(1, h.atk + delta("atk")),
      def: Math.max(0, h.def + delta("def")),
      spd: Math.max(1, h.spd + delta("spd")),
      luk: Math.max(0, h.luk + delta("luk")),
      maxHp,
      hp,
      maxMp,
      mp,
    };
  };

  const toggleEquip = (itemId: string) => {
    const def = getGearDef(itemId);
    if (!def) return;
    const count = hero.items[itemId] ?? 0;
    if (count <= 0) {
      appendLog("아이템이 없습니다.");
      return;
    }

    playSfx("EQUIP");
    const slot = def.slot;
    const isEquipped = hero.equipment[slot] === itemId;
    appendLog(isEquipped ? `장비 해제: ${def.name}` : `장비 장착: ${def.name}`);

    setHero((h) => {
      const cur = getGearDef(itemId);
      if (!cur) return h;
      const slotKey = cur.slot;
      const equippedId = h.equipment[slotKey];

      let next: HeroState = h;
      // Unequip
      if (equippedId === itemId) {
        next = applyGearBonus(next, cur.bonus, -1);
        return { ...next, equipment: { ...next.equipment, [slotKey]: null } };
      }

      // Replace equipped
      if (equippedId) {
        const old = getGearDef(equippedId);
        if (old) next = applyGearBonus(next, old.bonus, -1);
      }
      next = applyGearBonus(next, cur.bonus, 1);
      return { ...next, equipment: { ...next.equipment, [slotKey]: itemId } };
    });
  };

  const endRunDead = () => {
    if (phase === "DEAD" || phase === "CLEAR") return;
    setPhase("DEAD");
    appendLog("당신은 쓰러졌습니다.");

    const diff = dungeon?.difficulty ?? "NORMAL";
    const earnedGold = Math.max(0, Math.round(FAILURE_REWARD_BY_DIFFICULTY[diff]));
    if (!settled && uid && earnedGold > 0) {
      setSettled(true);
      addResources({ gold: earnedGold });
      updateDoc(doc(db, "users", uid), {
        "resources.gold": increment(earnedGold),
        lastFailAt: serverTimestamp(),
      }).catch(() => {});
      appendLog(`위로금: 보유 골드 +${earnedGold}G`);
      playSfx("COIN");
    }
  };

  const grantRewards = (card: CardData) => {
    let leveled = false;
    const diff = dungeon?.difficulty ?? "NORMAL";
    const progress =
      dungeon && dungeon.room_count > 0
        ? clamp((progressStepIndex + 1) / dungeon.room_count, 0, 1)
        : 0;
    const category = String(card.category ?? "");
    const isBoss = category === "CARD_BOSS";
    const isChest = category === "CARD_LOOT_CHEST";
    const isCombat = isCombatCard(category);

    let gold = goldFromReward(card.rewards);
    let items = itemsFromReward(card.rewards)
      .map((id) => String(id ?? "").trim().toUpperCase())
      .filter((id) => id.length > 0);
    const adaptiveBoost = getAdaptiveConsumableDropBoost({
      difficulty: diff,
      hp: hero.hp,
      maxHp: hero.maxHp,
      potionCount: potionCountTotal,
      progressRatio: progress,
      recentDamageTaken: Math.max(0, hero.maxHp - hero.hp),
    });
    let pityTriggered = false;

    // If the dungeon author didn't specify rewards, keep the run from feeling empty.
    if (gold <= 0 && (isCombat || isChest)) {
      const source = isBoss ? "BOSS" : isChest ? "CHEST" : "COMBAT";
      gold = getFallbackRewardGold(diff, source, progress);
    }

    // Roll a lightweight gear drop (in-dungeon only).
    const gearPool = GEAR_POOL_BY_DIFFICULTY[diff] ?? [];
    const ownedGearCount = Object.entries(hero.items)
      .filter(([id, c]) => (c ?? 0) > 0 && isGearItemId(id))
      .reduce((acc, [, c]) => acc + (typeof c === "number" && Number.isFinite(c) ? c : 0), 0);
    const gearSource = isBoss ? "BOSS" : isChest ? "CHEST" : "COMBAT";
    const gearChance =
      isCombat || isChest || isBoss
        ? getGearDropChance(diff, gearSource, progress, ownedGearCount)
        : 0;
    if (gearPool.length > 0 && Math.random() < gearChance) {
      items.push(gearPool[randInt(0, gearPool.length - 1)]!);
    }

    // Small chance of consumables/tools when item rewards are missing.
    if (
      items.length === 0 &&
      (isCombat || isChest) &&
      (() => {
        const baseChance = getFallbackConsumableDropChance(diff, progress);
        const totalChance = clamp(baseChance + adaptiveBoost.bonusChance, 0, 0.95);
        const rollValue = Math.random();
        if (rollValue >= totalChance) return false;
        if (adaptiveBoost.active && rollValue >= baseChance) pityTriggered = true;
        return true;
      })()
    ) {
      const pool = ["ITEM_POTION_S", "ITEM_SHARPENING_STONE", "ITEM_ARMOR_PATCH", "ITEM_SMOKE_BOMB"];
      items = [pool[randInt(0, pool.length - 1)]!];
    }
    if (pityTriggered) {
      appendLog(`위기 보정: 추가 보급 발견 (${adaptiveBoost.note})`);
      pushRunTelemetry({ pityDrops: 1 });
    }

    if (gold > 0) {
      const debt = hero.goldDebt;
      const paid = Math.min(debt, gold);
      const earned = gold - paid;
      if (paid > 0) pushRunTelemetry({ debtPaid: paid });
      if (earned > 0) pushRunTelemetry({ goldEarned: earned });

      if (paid > 0) appendLog(`시간 손실로 상쇄: -${paid}G`);
      if (earned > 0) {
        appendLog(`던전 골드 획득: +${earned}G`);
        playSfx("COIN");
      }

      setHero((h) => ({
        ...h,
        goldDebt: Math.max(0, h.goldDebt - paid),
        gold: h.gold + earned,
        rewardGold: h.rewardGold + earned,
      }));
    }
    if (items.length) {
      pushRunTelemetry({ itemsEarned: items.length });
      setHero((h) => {
        const next = { ...h.items };
        for (const id of items) next[id] = (next[id] ?? 0) + 1;
        return { ...h, items: next };
      });
      const display = items.map((id) => itemDisplayName(id)).filter((s) => s.length > 0);
      appendLog(`아이템 획득: ${display.join(", ")}`);
    }

    const xpGain = xpFromCard(card, diff, progress);
    if (xpGain > 0) {
      pushRunTelemetry({ xpEarned: xpGain });
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
    pushRunTelemetry({ turnsTaken: 1 });
    const { dmg, lines } = calcEndOfTurnDot(h.maxHp, h.effects);
    const nextHp = dmg > 0 ? Math.max(0, h.hp - dmg) : h.hp;
    if (dmg > 0) pushRunTelemetry({ damageTaken: dmg });
    if (lines.length) for (const line of lines) appendLog(line);
    const nextEffects = tickDownEffects(h.effects, 1);
    const clericRegen =
      effectiveHeroClass === "CLERIC" ? Math.max(0, Math.round(h.maxHp * 0.05)) : 0;
    const healedHp =
      clericRegen > 0 ? Math.min(h.maxHp, nextHp + clericRegen) : nextHp;
    const recovered = Math.max(0, healedHp - nextHp);
    if (recovered > 0) pushRunTelemetry({ hpRecovered: recovered });
    if (clericRegen > 0) appendLog(`은총: +${clericRegen} HP`);

    setHero({ ...h, hp: healedHp, effects: nextEffects });
    if (healedHp <= 0) {
      endRunDead();
      return;
    }
    setTurn("ENEMY");
  };

  const resolveCombatVictory = () => {
    if (!currentCard) return;
    pushRunTelemetry({ combatsWon: 1 });
    if (currentCard.category === "CARD_SHRINE" && pendingShrineOption) {
      appendLog("제단의 계약이 성립됩니다.");
      applyShrine(pendingShrineOption, "REWARD_ONLY");
      setPendingShrineOption(null);
    }
    finishEncounter(currentCard);
  };

  const playerAttack = (
    mul: number,
    skillName: string,
    heroAfterAction?: HeroState,
    onHitEffect?: { id: string; chance: number; stacks?: number; turns?: number },
    attackAttr?: string | null,
  ) => {
    const party = enemiesRef.current;
    const pick =
      (targetEnemyId ? party.find((e) => e.id === targetEnemyId && e.hp > 0) : null) ??
      party.find((e) => e.hp > 0) ??
      null;
    if (!pick) return;
    pushRunTelemetry({ playerActions: 1 });

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
    const attr = damageFactorFor(attackAttr, pick.tags);
    const dmg =
      attr.factor === 0
        ? 0
        : calcDamage(atk, pick.def, mul * attr.factor * critMul);
    const delta: RunTelemetryDelta = {};
    if (dmg > 0) delta.damageDealt = dmg;
    if (crit) delta.criticalHits = 1;
    const nextHp = pick.hp - dmg;
    const willApplyEffect =
      Boolean(onHitEffect) &&
      nextHp > 0 &&
      Math.random() <= clamp(onHitEffect!.chance, 0, 1);

    let killed = 0;
    const nextParty = party.map((e) => {
      if (e.id !== pick.id) return e;
      const hp = Math.max(0, e.hp - dmg);
      const effects =
        willApplyEffect && hp > 0
          ? upsertEffect(e.effects, onHitEffect!.id, {
              stacks: onHitEffect!.stacks ?? 1,
              turns: onHitEffect!.turns ?? DEFAULT_EFFECT_TURNS,
            })
          : e.effects;
      if (e.hp > 0 && hp <= 0) killed += 1;
      return { ...e, hp, effects };
    });
    enemiesRef.current = nextParty;
    setEnemies(nextParty);
    if (dmg > 0) {
      setEnemyHitTick((t) => t + 1);
      playSfx("HIT");
    }
    const note = attr.note ? ` (${attr.note})` : "";
    appendLog(`${skillName}: ${pick.name}에게 ${dmg} 피해${note}`);
    if (crit) {
      appendLog("치명타!");
      playSfx("CRIT");
      triggerShake(10);
    }

    if (nextHp <= 0) {
      appendLog(`${pick.name} 처치`);
    }
    if (willApplyEffect) {
      appendLog(`${pick.name}에게 ${effectLabel(onHitEffect!.id)} 부여`);
    }
    if (killed > 0) {
      incrementQuest("KILL_ENEMY", killed);
      delta.enemyKills = killed;
    }
    pushRunTelemetry(delta);
    const aliveAfter = nextParty.some((e) => e.hp > 0);
    if (!aliveAfter) return; // victory is handled by a separate effect
    endPlayerTurn(attacker);
  };

  const playerAttackAll = (
    mul: number,
    skillName: string,
    heroAfterAction?: HeroState,
    onHitEffect?: { id: string; chance: number; stacks?: number; turns?: number },
    attackAttr?: string | null,
  ) => {
    const party = enemiesRef.current;
    const targets = party.filter((e) => e.hp > 0);
    if (targets.length === 0) return;
    pushRunTelemetry({ playerActions: 1 });

    const attacker = heroAfterAction ?? hero;
    if (hasEffect(attacker.effects, "STATUS_CONFUSION") && Math.random() < 0.35) {
      appendLog("혼란으로 인해 행동에 실패했습니다.");
      endPlayerTurn(attacker);
      return;
    }
    const blindMiss = hasEffect(attacker.effects, "STATUS_BLIND") && Math.random() < 0.35;
    if (blindMiss) {
      appendLog("실명으로 공격이 빗나갑니다.");
      endPlayerTurn(attacker);
      return;
    }

    const forcedFirstCrit = effectiveHeroClass === "ROGUE" && rogueFirstStrike;
    if (forcedFirstCrit) setRogueFirstStrike(false);
    const crit =
      forcedFirstCrit || Math.random() < calcCritChance(Math.max(0, attacker.luk));
    const critMul = crit ? 1.35 : 1.0;

    const atk =
      hasEffect(attacker.effects, "STATUS_WEAK")
        ? Math.max(1, Math.round(attacker.atk * 0.75))
        : attacker.atk;

    let killed = 0;
    let didHit = false;
    let totalDamage = 0;
    const lines: string[] = [];
    const effectLines: string[] = [];

    const nextParty = party.map((e) => {
      if (e.hp <= 0) return e;
      const attr = damageFactorFor(attackAttr, e.tags);
      const dmg =
        attr.factor === 0
          ? 0
          : calcDamage(atk, e.def, mul * attr.factor * critMul);
      totalDamage += Math.max(0, dmg);
      const nextHp = Math.max(0, e.hp - dmg);

      const willApplyEffect =
        Boolean(onHitEffect) &&
        nextHp > 0 &&
        Math.random() <= clamp(onHitEffect!.chance, 0, 1);
      const effects =
        willApplyEffect && nextHp > 0
          ? upsertEffect(e.effects, onHitEffect!.id, {
              stacks: onHitEffect!.stacks ?? 1,
              turns: onHitEffect!.turns ?? DEFAULT_EFFECT_TURNS,
            })
          : e.effects;

      if (dmg > 0) didHit = true;
      const note = attr.note ? ` (${attr.note})` : "";
      lines.push(`${skillName}: ${e.name}에게 ${dmg} 피해${note}`);
      if (willApplyEffect) effectLines.push(`${e.name}에게 ${effectLabel(onHitEffect!.id)} 부여`);
      if (e.hp > 0 && nextHp <= 0) killed += 1;
      return { ...e, hp: nextHp, effects };
    });

    enemiesRef.current = nextParty;
    setEnemies(nextParty);
    if (didHit) {
      setEnemyHitTick((t) => t + 1);
      playSfx("HIT");
    }
    for (const line of lines) appendLog(line);
    for (const line of effectLines.slice(0, 6)) appendLog(line);
    if (crit) {
      appendLog("치명타!");
      playSfx("CRIT");
      triggerShake(10);
    }
    const delta: RunTelemetryDelta = {};
    if (totalDamage > 0) delta.damageDealt = totalDamage;
    if (crit) delta.criticalHits = 1;
    if (killed > 0) {
      incrementQuest("KILL_ENEMY", killed);
      delta.enemyKills = killed;
    }
    pushRunTelemetry(delta);

    const aliveAfter = nextParty.some((e) => e.hp > 0);
    if (!aliveAfter) return; // victory is handled by a separate effect
    endPlayerTurn(attacker);
  };

  useEffect(() => {
    if (phase !== "COMBAT") return;
    if (enemies.length === 0) return;
    if (aliveEnemies.length > 0) return;
    resolveCombatVictory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, enemies.length, aliveEnemies.length]);

  const enemyPhaseRunId = useRef(0);

  // Auto-run enemy phase (all alive enemies act once).
  useEffect(() => {
    if (phase !== "COMBAT") return;
    if (turn !== "ENEMY") return;

    const runId = ++enemyPhaseRunId.current;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, ms));

    const run = async () => {
      const party = enemiesRef.current.map((e) => ({ ...e }));
      if (party.every((e) => e.hp <= 0)) {
        setTurn("PLAYER");
        return;
      }

      const aliveCountStart = party.reduce((acc, e) => acc + (e.hp > 0 ? 1 : 0), 0);
      const squadMul =
        aliveCountStart >= 4 ? 0.8 : aliveCountStart === 3 ? 0.86 : aliveCountStart === 2 ? 0.93 : 1.0;

      // Start-of-phase effects (regen etc) for each alive enemy.
      for (const e of party) {
        if (e.hp <= 0) continue;
        const hot = calcStartOfTurnHot(e.maxHp, e.hp, e.effects);
        if (hot.heal > 0) {
          for (const line of hot.lines) appendLog(`${e.name}: ${line}`);
          e.hp = Math.min(e.maxHp, e.hp + hot.heal);
        }
      }
      enemiesRef.current = party;
      setEnemies(party);

      // Each alive enemy takes one action (unless stunned).
      for (const e of party) {
        if (enemyPhaseRunId.current !== runId) return;
        if (phase !== "COMBAT") return;
        if (e.hp <= 0) continue;

        if (hasEffect(e.effects, "STATUS_STUN")) {
          appendLog(`${e.name}이(가) 기절했습니다.`);
          continue;
        }

        await sleep(380);
        if (enemyPhaseRunId.current !== runId) return;

        const action = pickEnemyAction(e.actions, e.maxHp > 0 ? e.hp / e.maxHp : 1);
        const mul = (action?.value ?? 1.0) * squadMul;
        const msg = action?.msg ?? `${e.name}의 공격`;
        pushRunTelemetry({ enemyActions: 1 });

        const blindMiss = hasEffect(e.effects, "STATUS_BLIND") && Math.random() < 0.35;
        if (blindMiss) {
          appendLog(`${msg} (빗나감)`);
          continue;
        }

        const attackerAtk =
          hasEffect(e.effects, "STATUS_WEAK") ? Math.max(1, Math.round(e.atk * 0.75)) : e.atk;
        const h0 = heroRef.current;
        const ironWill =
          effectiveHeroClass === "WARRIOR" &&
          h0.maxHp > 0 &&
          h0.hp / h0.maxHp <= 0.3;
        const reduction = (defending ? 0.5 : 1) * (ironWill ? 0.7 : 1);
        const dmg = calcDamage(attackerAtk, h0.def, mul, reduction);

        appendLog(msg);
        const inflict = ATTR_INFLICTS_STATUS.find((x) => (e.tags ?? []).includes(x.attr));
        const willInflict = Boolean(inflict) && Math.random() <= clamp(inflict!.chance, 0, 1);
        const resistChance = calcStatusResistChance(h0.luk);
        const resisted = willInflict && Math.random() < resistChance;

        if (willInflict && resisted) {
          appendLog(`저항: ${effectLabel(inflict!.status)}`);
        } else if (willInflict) {
          appendLog(`${effectLabel(inflict!.status)} 부여`);
        }

        const manaShield =
          effectiveHeroClass === "MAGE" && h0.mp > 0 ? Math.max(0, Math.round(dmg * 0.4)) : 0;
        const mpAbsorb = Math.min(h0.mp, manaShield);
        const hpDmg = Math.max(0, dmg - mpAbsorb);
        if (hpDmg > 0) pushRunTelemetry({ damageTaken: hpDmg });

        let nextEffects = h0.effects;
        if (willInflict && !resisted && inflict) {
          nextEffects = upsertEffect(nextEffects, inflict.status, { turns: DEFAULT_EFFECT_TURNS });
        }

        const nextHero: HeroState = {
          ...h0,
          hp: Math.max(0, h0.hp - hpDmg),
          mp: Math.max(0, h0.mp - mpAbsorb),
          effects: nextEffects,
        };
        heroRef.current = nextHero;
        setHero(nextHero);

        if (hpDmg > 0 || mpAbsorb > 0) {
          setHeroHitTick((t) => t + 1);
          playSfx("HIT");
        }
        if (ironWill) appendLog("불굴: 피해 감소");
        appendLog(mpAbsorb > 0 ? `피해: -${hpDmg} HP, -${mpAbsorb} MP` : `피해: -${hpDmg} HP`);
        if (hpDmg >= Math.max(1, Math.round(h0.maxHp * 0.18))) triggerShake(8);

        if (nextHero.hp <= 0) {
          setDefending(false);
          endRunDead();
          return;
        }
      }

      // End-of-phase DOT + effect tick-down for enemies (once per round).
      let killedByDot = 0;
      for (const e of party) {
        if (e.hp <= 0) continue;
        const { dmg, lines } = calcEndOfTurnDot(e.maxHp, e.effects);
        const nextHp = dmg > 0 ? Math.max(0, e.hp - dmg) : e.hp;
        if (lines.length) for (const line of lines) appendLog(`${e.name}: ${line}`);
        e.effects = tickDownEffects(e.effects, 1);
        if (e.hp > 0 && nextHp <= 0) {
          killedByDot += 1;
          appendLog(`${e.name} 처치`);
        }
        e.hp = nextHp;
      }
      if (killedByDot > 0) {
        incrementQuest("KILL_ENEMY", killedByDot);
        pushRunTelemetry({ enemyKills: killedByDot });
      }

      enemiesRef.current = party;
      setEnemies(party);
      setDefending(false);
      setTurn("PLAYER");
    };

    run();
    return () => {
      enemyPhaseRunId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase]);

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
      pushRunTelemetry({ hpRecovered: hot.heal });
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
    if (phase === "COMBAT" && aliveEnemies.length > 0 && targetEnemy) {
      const enemy = targetEnemy;
      const isPlayerTurn = turn === "PLAYER";
      const canFireball = effectiveHeroClass === "MAGE" && hero.mp >= 10 && isPlayerTurn;
      const canFrostbolt = effectiveHeroClass === "MAGE" && hero.mp >= 8 && isPlayerTurn;
      const canChain =
        effectiveHeroClass === "MAGE" && hero.mp >= 14 && isPlayerTurn && aliveEnemies.length >= 2;
      const canBash = effectiveHeroClass === "WARRIOR" && hero.mp >= 6 && isPlayerTurn;
      const canAssassinate = effectiveHeroClass === "ROGUE" && hero.mp >= 6 && isPlayerTurn;
      const canAimShot = effectiveHeroClass === "RANGER" && hero.mp >= 6 && isPlayerTurn;
      const canHealSpell = effectiveHeroClass === "CLERIC" && hero.mp >= 8 && isPlayerTurn;
      const potionCount = Object.entries(hero.items)
        .filter(([id]) => id.startsWith("ITEM_POTION"))
        .reduce((acc, [, n]) => acc + (typeof n === "number" && Number.isFinite(n) ? n : 0), 0);
      const canPotion = potionCount > 0 && isPlayerTurn;
      const hasSmoke = (hero.items.ITEM_SMOKE_BOMB ?? 0) > 0;
      const hasSharpen = (hero.items.ITEM_SHARPENING_STONE ?? 0) > 0;
      const hasArmorPatch = (hero.items.ITEM_ARMOR_PATCH ?? 0) > 0;
      const enemySpdMax = aliveEnemies.reduce((m, e) => Math.max(m, e.spd), 0);
      const attackStat =
        hasEffect(hero.effects, "STATUS_WEAK")
          ? Math.max(1, Math.round(hero.atk * 0.75))
          : hero.atk;
      const expectedPlayerHit = calcDamage(attackStat, enemy.def, 1);
      const expectedPlayerCrit = calcDamage(attackStat, enemy.def, 1.5);
      const expectedEnemyAtk = aliveEnemies.reduce((m, e) => Math.max(m, e.atk), 0);
      const expectedEnemyHit = calcDamage(
        expectedEnemyAtk,
        hero.def,
        1,
        defending ? 0.5 : 1,
      );
      const critChancePercent = Math.round(
        calcCritChance(Math.max(0, hero.luk)) * 100,
      );
      const fleeChancePercent = Math.round(calcFleeChance(hero.spd, enemySpdMax) * 100);
      return (
        <div className="grid gap-2">
          <div
            className={`border border-gray-800 bg-black/20 rounded-lg p-3 ${
              heroFlash ? "ring-1 ring-red-500/40" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500">나</span>
              <span className="text-gray-600">
                {turn === "PLAYER" ? "내 턴" : "적 턴"}
              </span>
            </div>
            <div className="mt-2 grid gap-2">
              <div className="grid gap-1">
                <div className="flex items-center justify-between gap-2 text-xs">
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
              </div>
              <div className="grid gap-1">
                <div className="flex items-center justify-between gap-2 text-xs">
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
            </div>
          </div>

          {aliveEnemies.length > 1 && (
            <div className="border border-gray-800 bg-black/20 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-2">타겟 선택</div>
              <div className="grid gap-1">
                {aliveEnemies.slice(0, 6).map((e) => {
                  const selected = e.id === enemy.id;
                  const ratio = e.maxHp > 0 ? clamp(e.hp / e.maxHp, 0, 1) : 0;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setTargetEnemyId(e.id)}
                      className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                        selected
                          ? "border-primary/40 bg-primary/5"
                          : "border-gray-800 bg-gray-950/20 hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-200 font-semibold truncate">{e.name}</span>
                        <span className="text-gray-500 tabular-nums">
                          {e.hp}/{e.maxHp}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded bg-black/40 border border-gray-800 overflow-hidden">
                        <div
                          className="h-1.5 bg-emerald-500/70"
                          style={{ width: `${Math.round(ratio * 100)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={`border border-gray-800 bg-black/20 rounded-lg p-3 ${
              enemyFlash ? "ring-1 ring-red-500/40" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm text-gray-200 font-bold truncate">
                  {enemy.name}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-600 flex items-center gap-2">
                  <span>ATK {enemy.atk}</span>
                  <span>DEF {enemy.def}</span>
                  <span>SPD {enemy.spd}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                HP {enemy.hp}/{enemy.maxHp}
              </div>
            </div>
            <div className="mt-2 h-2 rounded bg-black/40 border border-gray-800 overflow-hidden">
              <div
                className="h-2 bg-emerald-500/70"
                style={{
                  width: `${enemy.maxHp > 0 ? Math.round((enemy.hp / enemy.maxHp) * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="border border-gray-800 bg-black/20 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-2">전투 예측</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <MiniStat label="내 기본 피해" value={expectedPlayerHit} />
              <MiniStat label="내 치명 피해" value={expectedPlayerCrit} />
              <MiniStat label="적 예상 피해" value={expectedEnemyHit} />
              <MiniStat label="치명 확률" value={`${critChancePercent}%`} />
              <MiniStat label="도주 확률" value={`${fleeChancePercent}%`} />
              <MiniStat
                label="위험도"
                value={`${riskState.label} (${riskState.score})`}
              />
            </div>
          </div>

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
            onClick={() => {
              playSfx("UI");
              playerAttack(1.0, "공격", undefined, undefined, HERO_BASE_ATTR[effectiveHeroClass]);
            }}
            disabled={turn !== "PLAYER"}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaPlay />
            <span>공격</span>
          </button>
          <button
            onClick={() => {
              playSfx("UI");
              pushRunTelemetry({ playerActions: 1 });
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
          {effectiveHeroClass === "WARRIOR" && (
            <button
              onClick={() => {
                if (!canBash) return;
                playSfx("UI");
                const nextHero = { ...hero, mp: hero.mp - 6 };
                setHero(nextHero);
                playerAttack(
                  1.25,
                  "방패 강타",
                  nextHero,
                  { id: "STATUS_STUN", chance: 0.25, turns: 1 },
                  "ATTR_SOUND",
                );
              }}
              disabled={!canBash}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
            >
              <FaUserShield />
              <span>방패 강타 (MP 6)</span>
            </button>
          )}
          {effectiveHeroClass === "ROGUE" && (
            <button
              onClick={() => {
                if (!canAssassinate) return;
                playSfx("UI");
                const finisher = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp <= 0.35 : false;
                const nextHero = { ...hero, mp: hero.mp - 6 };
                setHero(nextHero);
                playerAttack(
                  finisher ? 2.0 : 1.4,
                  "암살",
                  nextHero,
                  { id: "STATUS_BLEED", chance: 0.45, turns: 2 },
                  "ATTR_DARK",
                );
              }}
              disabled={!canAssassinate}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
            >
              <FaSkull />
              <span>암살 (MP 6)</span>
            </button>
          )}
          {effectiveHeroClass === "RANGER" && (
            <button
              onClick={() => {
                if (!canAimShot) return;
                playSfx("UI");
                const nextHero = { ...hero, mp: hero.mp - 6 };
                setHero(nextHero);
                playerAttack(
                  1.35,
                  "조준 사격",
                  nextHero,
                  { id: "STATUS_BLEED", chance: 0.35, turns: 2 },
                  "ATTR_PHYSICAL_PIERCE",
                );
              }}
              disabled={!canAimShot}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
            >
              <FaArrowRight />
              <span>조준 사격 (MP 6)</span>
            </button>
          )}
          {effectiveHeroClass === "MAGE" && (
            <>
              <button
                onClick={() => {
                  if (!canFireball) return;
                  playSfx("UI");
                  const nextHero = { ...hero, mp: hero.mp - 10 };
                  setHero(nextHero);
                  playerAttack(
                    1.6,
                    "화염구",
                    nextHero,
                    { id: "STATUS_BURN", chance: 0.4, turns: 2 },
                    "ATTR_FIRE",
                  );
                }}
                disabled={!canFireball}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
              >
                <FaBolt />
                <span>화염구 (MP 10)</span>
              </button>
              <button
                onClick={() => {
                  if (!canFrostbolt) return;
                  playSfx("UI");
                  const nextHero = { ...hero, mp: hero.mp - 8 };
                  setHero(nextHero);
                  playerAttack(
                    1.25,
                    "서리창",
                    nextHero,
                    { id: "STATUS_CHILL", chance: 0.45, turns: 2 },
                    "ATTR_ICE",
                  );
                }}
                disabled={!canFrostbolt}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
              >
                <FaBolt />
                <span>서리창 (MP 8)</span>
              </button>
              {aliveEnemies.length >= 2 && (
                <button
                  onClick={() => {
                    if (!canChain) return;
                    playSfx("UI");
                    const nextHero = { ...hero, mp: hero.mp - 14 };
                    setHero(nextHero);
                    playerAttackAll(
                      1.05,
                      "연쇄 번개",
                      nextHero,
                      { id: "STATUS_SHOCK", chance: 0.22, turns: 1 },
                      "ATTR_LIGHTNING",
                    );
                  }}
                  disabled={!canChain}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
                >
                  <FaBolt />
                  <span>연쇄 번개 (MP 14)</span>
                </button>
              )}
            </>
          )}
          {effectiveHeroClass === "CLERIC" && (
            <button
              onClick={() => {
                if (!canHealSpell) return;
                playSfx("UI");
                playSfx("HEAL");
                const heal = Math.max(1, Math.round(hero.maxHp * 0.22));
                const healed = Math.max(0, Math.min(hero.maxHp, hero.hp + heal) - hero.hp);
                const removeIdx = hero.effects.findIndex((e) => e.id.startsWith("STATUS_"));
                const removed = removeIdx >= 0 ? hero.effects[removeIdx] : null;
                const nextEffects =
                  removeIdx >= 0
                    ? hero.effects.filter((_, idx) => idx !== removeIdx)
                    : hero.effects;
                const nextHero: HeroState = {
                  ...hero,
                  mp: hero.mp - 8,
                  hp: Math.min(hero.maxHp, hero.hp + heal),
                  effects: nextEffects,
                };
                pushRunTelemetry({
                  playerActions: 1,
                  hpRecovered: healed,
                  mpRecovered: 0,
                });
                setHero(nextHero);
                appendLog(`치유: +${heal} HP`);
                if (removed) appendLog(`정화: ${effectLabel(removed.id)} 해제`);
                endPlayerTurn(nextHero);
              }}
              disabled={!canHealSpell}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
            >
              <FaHeart />
              <span>치유 (MP 8)</span>
            </button>
          )}
          <button
            onClick={() => {
              if (!canPotion) return;
              playSfx("HEAL");
              const nextItems = { ...hero.items };
              const order = ["ITEM_POTION_L", "ITEM_POTION_M", "ITEM_POTION_S"];
              let used: string | null = null;
              for (const key of order) {
                if ((nextItems[key] ?? 0) > 0) {
                  nextItems[key] = Math.max(0, (nextItems[key] ?? 0) - 1);
                  used = key;
                  break;
                }
              }
              if (!used) {
                const fallbackPotionId = Object.keys(nextItems).find(
                  (k) => k.startsWith("ITEM_POTION") && (nextItems[k] ?? 0) > 0,
                );
                if (fallbackPotionId) {
                  nextItems[fallbackPotionId] = Math.max(
                    0,
                    (nextItems[fallbackPotionId] ?? 0) - 1,
                  );
                  used = fallbackPotionId;
                }
              }
              if (!used) return;
              if ((nextItems[used] ?? 0) <= 0) delete nextItems[used];

              const heal = Math.round(hero.maxHp * 0.35);
              const healed = Math.max(0, Math.min(hero.maxHp, hero.hp + heal) - hero.hp);
              pushRunTelemetry({
                playerActions: 1,
                itemsUsed: 1,
                hpRecovered: healed,
              });
              appendLog(`포션 사용: +${heal} HP`);
              endPlayerTurn({
                ...hero,
                hp: Math.min(hero.maxHp, hero.hp + heal),
                items: nextItems,
              });
            }}
            disabled={!canPotion}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaHeart />
            <span>포션{potionCount > 0 ? ` x${potionCount}` : ""}</span>
          </button>
          {hasSharpen && (
            <button
              onClick={() => {
                if (turn !== "PLAYER") return;
                playSfx("UI");
                const nextItems = { ...hero.items };
                nextItems.ITEM_SHARPENING_STONE = Math.max(
                  0,
                  (nextItems.ITEM_SHARPENING_STONE ?? 0) - 1,
                );
                if ((nextItems.ITEM_SHARPENING_STONE ?? 0) === 0)
                  delete nextItems.ITEM_SHARPENING_STONE;
                appendLog("숫돌 사용: 공격력 +2");
                pushRunTelemetry({ playerActions: 1, itemsUsed: 1 });
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
                playSfx("UI");
                const nextItems = { ...hero.items };
                nextItems.ITEM_ARMOR_PATCH = Math.max(
                  0,
                  (nextItems.ITEM_ARMOR_PATCH ?? 0) - 1,
                );
                if ((nextItems.ITEM_ARMOR_PATCH ?? 0) === 0)
                  delete nextItems.ITEM_ARMOR_PATCH;
                appendLog("갑옷 수선: 방어력 +2");
                pushRunTelemetry({ playerActions: 1, itemsUsed: 1 });
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
                playSfx("UI");
                const nextItems = { ...hero.items };
                nextItems.ITEM_SMOKE_BOMB = Math.max(
                  0,
                  (nextItems.ITEM_SMOKE_BOMB ?? 0) - 1,
                );
                if ((nextItems.ITEM_SMOKE_BOMB ?? 0) === 0)
                  delete nextItems.ITEM_SMOKE_BOMB;
                pushRunTelemetry({
                  playerActions: 1,
                  itemsUsed: 1,
                  fleeAttempts: 1,
                  fleeSuccess: 1,
                });
                appendLog("연막탄 사용: 확실한 도주");
                setHero((h) => ({ ...h, items: nextItems }));
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
              playSfx("UI");
              pushRunTelemetry({ playerActions: 1, fleeAttempts: 1 });
              const chance = calcFleeChance(hero.spd, enemySpdMax);
              const ok = Math.random() < chance;
              if (ok) {
                pushRunTelemetry({ fleeSuccess: 1 });
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

    // Trap (Room only: instant traps resolve immediately when armed)
    if (currentCard.category === "CARD_TRAP_ROOM") {
      if (!trapArmed) {
        return (
          <div className="space-y-2">
            {resolveAndContinueButton("계속", <FaArrowRight />, () =>
              finishEncounter(currentCard),
            )}
          </div>
        );
      }

      const dc = currentCard.check_info?.difficulty ?? 15;
      const dmgBase = getTrapDamageRatio(dungeon?.difficulty ?? "NORMAL", progressRatio);
      const trapDmg = Math.max(1, Math.round(hero.maxHp * dmgBase));

      return (
        <div className="grid gap-2">
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
            onClick={() => attemptTrap("DODGE", dc, trapDmg)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaShoePrints />
            <span>조심히 통과</span>
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

    // Event (Choice)
    if (currentCard.category === "CARD_EVENT_CHOICE") {
      return (
        <div className="grid gap-2">
          <button
            disabled={aiBusy}
            onClick={() =>
              resolveEventChoice({ kind: "APPROACH", label: "개입한다" })
            }
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaPlay />
            <span>개입한다</span>
          </button>
          <button
            disabled={aiBusy}
            onClick={() =>
              resolveEventChoice({ kind: "INVESTIGATE", label: "조사한다" })
            }
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaHandPaper />
            <span>조사한다</span>
          </button>
          <button
            disabled={aiBusy}
            onClick={() =>
              resolveEventChoice({ kind: "IGNORE", label: "무시하고 지나친다" })
            }
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            <FaArrowRight />
            <span>무시</span>
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
                setEnemies([{
                  id: "MIMIC",
                  name: "미믹",
                  maxHp: s.hp,
                  hp: s.hp,
                  atk: s.atk,
                  def: s.def,
                  spd: s.spd,
                  tags: ["TAG_BEAST"],
                  effects: [],
                }]);
                setTargetEnemyId("MIMIC");
                setPhase("COMBAT");
                setTurn(hero.spd >= s.spd ? "PLAYER" : "ENEMY");
                return;
              }
              appendLog("상자를 열었습니다.");
              incrementQuest("OPEN_CHEST", 1);
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
              if (!isMimic) incrementQuest("OPEN_CHEST", 1);
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
                      id: "GUARDIAN",
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
                    setEnemies([guardian]);
                    setTargetEnemyId(guardian.id);
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

    // Rest (campfire / smithy / statue: each has distinct interactions)
    if (currentCard.category === "CARD_REST_CAMPFIRE") {
      const healHp = Math.round(hero.maxHp * 0.4);
      const healMp = Math.round(hero.maxMp * 0.25);

      const scout = () => {
        if (!dungeon) return;
        const links = normalizeRoomLinks(dungeon.room_links, totalRooms);
        const link = links[roomIndex] ?? null;
        if (link === null) {
          appendLog("이곳이 끝입니다. 바깥 공기가 느껴집니다.");
          return;
        }
        const labelFor = (c: CardData | null) => {
          if (!c) return "알 수 없음";
          if (c.category.includes("BOSS")) return "보스";
          if (c.category.includes("ENEMY")) return "전투";
          if (c.category.includes("TRAP")) return "함정";
          if (c.category.includes("LOOT")) return "보물";
          if (c.category.includes("SHRINE")) return "제단";
          if (c.category.includes("REST")) return "휴식";
          if (c.category.includes("NPC")) return "NPC";
          return "이벤트";
        };
        if (Array.isArray(link)) {
          const a = dungeon.card_list?.[link[0]] ?? null;
          const b = dungeon.card_list?.[link[1]] ?? null;
          appendLog(`정찰: 왼쪽은 ${labelFor(a)}, 오른쪽은 ${labelFor(b)} 느낌입니다.`);
          return;
        }
        const next = dungeon.card_list?.[link] ?? null;
        appendLog(`정찰: 다음 방은 ${labelFor(next)}의 기운이 납니다.`);
      };

      return (
        <div className="grid gap-2">
          <button
            onClick={() => {
              appendLog("모닥불 앞에서 숨을 고릅니다.");
              pushRunTelemetry({
                hpRecovered: Math.max(0, Math.min(hero.maxHp, hero.hp + healHp) - hero.hp),
                mpRecovered: Math.max(0, Math.min(hero.maxMp, hero.mp + healMp) - hero.mp),
              });
              setHero((h) => ({
                ...h,
                hp: Math.min(h.maxHp, h.hp + healHp),
                mp: Math.min(h.maxMp, h.mp + healMp),
              }));
              appendLog(`회복: +${healHp} HP, +${healMp} MP`);
              setPhase("RESOLVED");
            }}
            className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            휴식하기
          </button>
          <button
            onClick={() => {
              appendLog("간단한 약초를 달여 포션을 만듭니다.");
              pushRunTelemetry({ itemsEarned: 1 });
              setHero((h) => {
                const nextItems = { ...h.items };
                nextItems.ITEM_POTION_S = (nextItems.ITEM_POTION_S ?? 0) + 1;
                return { ...h, items: nextItems };
              });
              setPhase("RESOLVED");
            }}
            className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            포션 만들기 (+1)
          </button>
          <button
            onClick={() => {
              appendLog("주변을 살핍니다.");
              scout();
              setPhase("RESOLVED");
            }}
            className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            정찰하기
          </button>
        </div>
      );
    }

    if (currentCard.category === "CARD_REST_SMITHY") {
      const cost = getSmithyUpgradeCost(dungeon?.difficulty ?? "NORMAL");
      const canPay = hero.gold >= cost;
      return (
        <div className="grid gap-2">
          <button
            disabled={!canPay}
            onClick={() => {
              if (!canPay) return;
              appendLog(`대장간: ${cost}G를 지불합니다.`);
              pushRunTelemetry({ goldSpent: cost });
              setHero((h) => ({ ...h, gold: h.gold - cost, atk: h.atk + 2 }));
              appendLog("무기 강화: 공격력 +2");
              setPhase("RESOLVED");
            }}
            className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            무기 강화 (+2 ATK) [{cost}G]
          </button>
          <button
            disabled={!canPay}
            onClick={() => {
              if (!canPay) return;
              appendLog(`대장간: ${cost}G를 지불합니다.`);
              pushRunTelemetry({ goldSpent: cost });
              setHero((h) => ({ ...h, gold: h.gold - cost, def: h.def + 2 }));
              appendLog("갑옷 보강: 방어력 +2");
              setPhase("RESOLVED");
            }}
            className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
          >
            갑옷 보강 (+2 DEF) [{cost}G]
          </button>
          <button
            onClick={() => {
              appendLog("수리 도구를 챙깁니다.");
              pushRunTelemetry({ itemsEarned: 1 });
              setHero((h) => {
                const nextItems = { ...h.items };
                nextItems.ITEM_ARMOR_PATCH = (nextItems.ITEM_ARMOR_PATCH ?? 0) + 1;
                return { ...h, items: nextItems };
              });
              setPhase("RESOLVED");
            }}
            className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            수선 키트 획득 (+1)
          </button>
          {!canPay && (
            <div className="text-xs text-red-400 px-1">던전 골드가 부족합니다.</div>
          )}
        </div>
      );
    }

    if (currentCard.category === "CARD_REST_STATUE") {
      const cleanseOne = () => {
        const debuffs = hero.effects.filter((e) => e.id.startsWith("STATUS_"));
        if (debuffs.length === 0) return false;
        const remove = debuffs[0]!;
        setHero((h) => ({ ...h, effects: h.effects.filter((e) => e !== remove) }));
        appendLog(`정화: ${effectLabel(remove.id)} 해제`);
        return true;
      };

      return (
        <div className="grid gap-2">
          <button
            onClick={() => {
              appendLog("신상 앞에서 무릎을 꿇습니다.");
              const ok = cleanseOne();
              if (!ok) appendLog("정화할 저주가 없습니다.");
              setPhase("RESOLVED");
            }}
            className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            기도하기 (디버프 1개 정화)
          </button>
          <button
            onClick={() => {
              appendLog("은은한 빛이 몸을 감쌉니다.");
              setHero((h) => ({
                ...h,
                effects: upsertEffect(h.effects, "BUFF_REGEN", { turns: 3 }),
              }));
              appendLog("축복: 재생 (3턴)");
              setPhase("RESOLVED");
            }}
            className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            축복 받기 (재생 3턴)
          </button>
          <button
            onClick={() => {
              appendLog("조용히 떠납니다.");
              setPhase("RESOLVED");
            }}
            className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            떠나기
          </button>
        </div>
      );
    }

    // NPC: Trader
    if (currentCard.category === "CARD_NPC_TRADER") {
      const diff = dungeon?.difficulty ?? "NORMAL";
      const itemLabel = (id: string) => itemDisplayName(id);

      const normalizeList = (raw: unknown) => {
        if (!Array.isArray(raw)) return [];
        const out: { id: string; price: number }[] = [];
        for (const it of raw.slice(0, 12)) {
          if (!it || typeof it !== "object") continue;
          const obj = it as Record<string, unknown>;
          const id = String(obj.id ?? "").trim().toUpperCase();
          const priceRaw = obj.price;
          const price =
            typeof priceRaw === "number" && Number.isFinite(priceRaw) ? Math.max(0, Math.round(priceRaw)) : 0;
          if (!id) continue;
          out.push({ id, price });
        }
        return out;
      };

      const defaultTradeList = (): { id: string; price: number }[] => {
        const base = getTraderBasePriceProfile(diff);
        const gearPool = GEAR_POOL_BY_DIFFICULTY[diff] ?? [];
        const gearId = gearPool.length > 0 ? gearPool[randInt(0, gearPool.length - 1)]! : null;
        const list = [
          { id: "ITEM_POTION_S", price: base.potion },
          { id: "ITEM_SHARPENING_STONE", price: base.tool },
          { id: "ITEM_ARMOR_PATCH", price: base.tool },
          { id: "ITEM_SMOKE_BOMB", price: base.smoke },
        ];
        if (gearId) {
          const def = getGearDef(gearId);
          const est = def ? estimateGearValue(def) : 0;
          const price = clamp(
            Math.round(base.gear + est * 0.55),
            Math.round(base.gear * 0.75),
            Math.round(base.gear * 3.2),
          );
          list.push({ id: gearId, price });
        }
        return list.slice(0, 6);
      };

      let list = normalizeList(currentCard.trade_list).slice(0, 6);
      if (list.length === 0) {
        list = defaultTradeList();
      } else {
        const hasGear = list.some((it) => isGearItemId(it.id));
        if (!hasGear) {
          const gearPool = GEAR_POOL_BY_DIFFICULTY[diff] ?? [];
          const gearId = gearPool.length > 0 ? gearPool[randInt(0, gearPool.length - 1)]! : null;
          if (gearId) {
            const base = getTraderBasePriceProfile(diff).gear;
            const def = getGearDef(gearId);
            const est = def ? estimateGearValue(def) : 0;
            const price = clamp(
              Math.round(base + est * 0.55),
              Math.round(base * 0.75),
              Math.round(base * 3.2),
            );
            list = [...list.slice(0, 5), { id: gearId, price }];
          }
        }
      }
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
                  playSfx("UI");
                  if (hero.gold < it.price) {
                    appendLog("골드가 부족합니다.");
                    return;
                  }
                  pushRunTelemetry({ goldSpent: it.price, itemsEarned: 1 });
                  setHero((h) => {
                    const nextItems = { ...h.items };
                    nextItems[it.id] = (nextItems[it.id] ?? 0) + 1;
                    return { ...h, gold: h.gold - it.price, items: nextItems };
                  });
                  appendLog(`구매: ${itemLabel(it.id)} (-${it.price}G)`);
                  if (isGearItemId(it.id)) playSfx("EQUIP");
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
              >
                <div className="min-w-0">
                  <div className="truncate">{itemLabel(it.id)}</div>
                  {isGearItemId(it.id) && getGearDef(it.id) ? (
                    <div className="text-[11px] text-gray-600 truncate">
                      {gearBonusText(getGearDef(it.id)!.bonus)}
                    </div>
                  ) : null}
                </div>
                <span className="text-sm text-gray-400">{it.price}G</span>
              </button>
            ))
          )}
          <button
            onClick={() => {
              playSfx("UI");
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

    // NPC: Talk (대화형)
    if (currentCard.category === "CARD_NPC_TALK") {
      const diff = dungeon?.difficulty ?? "NORMAL";
      const talkBalance = getNpcTalkBalance(diff);
      const talkXp = talkBalance.xp;
      const talkGold = talkBalance.gold;
      const infoCost = talkBalance.infoCost;

      const startChat = () => {
        const npcName = currentCard.name;
        const hint = nextRoomHint();
        const hintLine = hint ? hint.replace(/^힌트:\\s*/, "") : null;
        const first =
          currentCard.dialogue?.start ??
          "낯선 목소리가 어둠 속에서 흘러나옵니다. \"거기… 누군가?\"";
        const lines = [
          `${npcName}: ${first}`,
          "나: 길을 찾고 있다. 너는 이 던전을 알고 있나?",
          hintLine
            ? `${npcName}: ${hintLine}`
            : `${npcName}: 이곳은 방심하면 삼켜버리는 곳이다. 조심해라.`,
          "나: 고맙다. 계속 가겠다.",
        ];
        setNpcTalk({ lines, idx: 0, reward: { xp: talkXp, gold: talkGold } });
      };

      const advanceChat = () => {
        if (!npcTalk) return;
        const line = npcTalk.lines[npcTalk.idx];
        if (line) appendLog(line);
        const nextIdx = npcTalk.idx + 1;
        if (nextIdx >= npcTalk.lines.length) {
          const reward = npcTalk.reward;
          setNpcTalk(null);
          const rewards = {
            ...(currentCard.rewards ?? {}),
            xp: reward?.xp ?? 0,
            gold: reward?.gold ?? 0,
          };
          finishEncounter({ ...currentCard, rewards });
          return;
        }
        setNpcTalk({ ...npcTalk, idx: nextIdx });
      };

      const intimidate = () => {
        const dc = talkBalance.intimidateDc;
        const mod = Math.floor((hero.luk - 10) / 2);
        const r = randInt(1, 20) + mod;
        appendLog(`${currentCard.name}: \"…그 눈빛, 위험하군.\"`);
        appendLog(`위협 판정: ${r} vs DC ${dc}`);
        const ok = r >= dc;
        if (ok) {
          const g = talkBalance.intimidateGold;
          appendLog("상대가 주머니를 던지고 물러납니다.");
          finishEncounter({
            ...currentCard,
            rewards: {
              ...(currentCard.rewards ?? {}),
              gold: g,
              xp: Math.max(0, Math.round(talkXp * talkBalance.intimidateXpMultiplier)),
            },
          });
          return;
        }
        const dmg = Math.max(1, Math.round(hero.maxHp * talkBalance.intimidateFailHpRatio));
        appendLog("상대가 재빨리 후려칩니다.");
        appendLog(`피해: -${dmg} HP`);
        setHero((h) => ({
          ...h,
          hp: Math.max(0, h.hp - dmg),
          effects: upsertEffect(h.effects, "STATUS_WEAK", { turns: 2 }),
        }));
        setHeroHitTick((t) => t + 1);
        if (hero.hp - dmg <= 0) {
          endRunDead();
          return;
        }
        finishEncounter({
          ...currentCard,
          rewards: {
            ...(currentCard.rewards ?? {}),
            xp: Math.max(0, Math.round(talkXp * talkBalance.intimidateFailXpMultiplier)),
          },
        });
      };

      if (npcTalk && npcTalk.lines.length > 0) {
        const line = npcTalk.lines[npcTalk.idx] ?? "";
        return (
          <div className="grid gap-2">
            <div className="border border-gray-800 bg-black/20 rounded-lg p-3 text-sm text-gray-200">
              <div className="text-xs text-gray-500 mb-2">대화</div>
              <div className="leading-relaxed">{line}</div>
              <div className="mt-2 text-xs text-gray-600">
                {npcTalk.idx + 1} / {npcTalk.lines.length}
              </div>
            </div>
            <button
              onClick={advanceChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors"
            >
              <FaArrowRight />
              <span>계속</span>
            </button>
          </div>
        );
      }

      return (
        <div className="grid gap-2">
          <button
            onClick={startChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaPlay />
            <span>대화하기</span>
          </button>
          <button
            onClick={() => {
              if (hero.gold < infoCost) {
                appendLog("골드가 부족합니다.");
                return;
              }
              pushRunTelemetry({ goldSpent: infoCost });
              setHero((h) => ({ ...h, gold: Math.max(0, h.gold - infoCost) }));
              const hint = nextRoomHint();
              appendLog(`${currentCard.name}: ${hint ? hint.replace(/^힌트:\\s*/, "") : "조심해라."}`);
              finishEncounter({
                ...currentCard,
                rewards: {
                  ...(currentCard.rewards ?? {}),
                  xp: Math.max(0, Math.round(talkXp * talkBalance.infoXpMultiplier)),
                },
              });
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaClipboardList />
            <span>정보 요청 [{infoCost}G]</span>
          </button>
          <button
            onClick={intimidate}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaHandPaper />
            <span>위협하기</span>
          </button>
          <button
            onClick={() => {
              appendLog("대화를 끝냅니다.");
              finishEncounter(currentCard);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
          >
            <FaArrowRight />
            <span>떠나기</span>
          </button>
        </div>
      );
    }

    // NPC: Quest (fallback)
    if (currentCard.category === "CARD_NPC_QUEST") {
      return (
        <div className="space-y-2">
          {resolveAndContinueButton("계속", <FaArrowRight />, () => setPhase("RESOLVED"))}
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
      <header className="relative h-16 border-b border-gray-800 bg-surface/90 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 sm:px-6 sticky top-0 z-40">
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
          <div className="hidden md:block min-w-[150px] text-xs border border-gray-800 bg-black/40 rounded px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">위험도</span>
              <span className={riskToneClass}>{riskState.label}</span>
            </div>
            <div className="mt-2 h-1.5 rounded bg-black/50 border border-gray-800 overflow-hidden">
              <div
                className={`h-1.5 ${riskBarClass}`}
                style={{ width: `${riskState.score}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-gray-600 truncate">{riskState.note}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              playSfx("UI");
              setSfxEnabled((v) => !v);
            }}
            className="p-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            title={sfxEnabled ? "효과음 끄기" : "효과음 켜기"}
          >
            {sfxEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>
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

      <AnimatePresence>
        {heroFlash && (
          <motion.div
            className="fixed inset-0 z-30 pointer-events-none bg-red-900/15"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          />
        )}
      </AnimatePresence>

      <motion.main
        animate={shakeControls}
        className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 grid gap-6 lg:grid-cols-[360px_1fr] items-start"
      >
        <section className="grid gap-4 justify-center lg:justify-start">
          <div className="flex justify-center lg:justify-start">
            <div className="relative w-64 h-[380px] sm:w-72 sm:h-[420px]">
              {phase !== "FORK" && phase !== "ENTRY" && currentCard ? (
                <CardView
                  card={currentCard}
                  runtime={
                    phase === "COMBAT" && enemyMaxHpTotal > 0 && isCombatCard(currentCard.category)
                      ? { hp: enemyHpTotal, maxHp: enemyMaxHpTotal }
                      : undefined
                  }
                  className="w-64 h-[380px] sm:w-72 sm:h-[420px]"
                />
              ) : (
                <div className="w-64 h-[380px] sm:w-72 sm:h-[420px] border border-gray-800 bg-surface/60 rounded-lg" />
              )}
              {phase === "COMBAT" && aliveEnemies.length > 0 ? (
                <div className="pointer-events-none absolute left-3 right-3 bottom-3">
                  <div className="flex items-center justify-between text-[11px] text-gray-300">
                    <span className="truncate">
                      {aliveEnemies.length > 1
                        ? `적 무리 (${aliveEnemies.length})`
                        : (targetEnemy?.name ?? "적")}
                    </span>
                    <span className="tabular-nums">
                      {enemyHpTotal}/{enemyMaxHpTotal}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-black/50 border border-gray-800 overflow-hidden">
                    <div
                      className="h-2 bg-emerald-500/70"
                      style={{
                        width: `${enemyMaxHpTotal > 0 ? Math.round((enemyHpTotal / enemyMaxHpTotal) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <AnimatePresence>
                {enemyFlash && phase === "COMBAT" ? (
                  <motion.div
                    className="pointer-events-none absolute inset-0 rounded-lg bg-red-700/15"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                  />
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className="w-64 sm:w-72 border border-gray-800 bg-surface/60 rounded-lg p-4 hidden lg:block">
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

              <div className="border border-gray-800 bg-black/20 rounded p-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500">위험도</span>
                  <span className={riskToneClass}>{riskState.label}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-black/50 border border-gray-800 overflow-hidden">
                  <div
                    className={`h-1.5 ${riskBarClass}`}
                    style={{ width: `${riskState.score}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-gray-600">{riskState.note}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <MiniStat label="LV" value={hero.level} />
                <MiniStat label="XP" value={`${hero.xp}/${xpToNext(hero.level)}`} />
                <MiniStat label="ATK" value={hero.atk} />
                <MiniStat label="DEF" value={hero.def} />
                <MiniStat label="SPD" value={hero.spd} />
                <MiniStat label="LUK" value={hero.luk} />
                <MiniStat label="GOLD" value={hero.gold} />
                <MiniStat label="정산" value={hero.rewardGold} />
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

              <div>
                <div className="text-xs text-gray-500 mb-2">장비</div>
                <div className="grid gap-1 text-xs text-gray-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">무기</span>
                    <span className="truncate text-gray-200">
                      {hero.equipment.weapon ? gearName(hero.equipment.weapon) : "없음"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">갑옷</span>
                    <span className="truncate text-gray-200">
                      {hero.equipment.armor ? gearName(hero.equipment.armor) : "없음"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">장신구</span>
                    <span className="truncate text-gray-200">
                      {hero.equipment.accessory ? gearName(hero.equipment.accessory) : "없음"}
                    </span>
                  </div>
                </div>
              </div>

              {Object.keys(hero.items).length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">가방</div>
                  <div className="grid gap-1 text-xs text-gray-300">
                    {Object.entries(hero.items)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .slice(0, 12)
                      .map(([id, count]) => {
                        const gear = isGearItemId(id) ? getGearDef(id) : null;
                        const equipped = gear ? hero.equipment[gear.slot] === id : false;
                        const gearHint =
                          gear ? `${gear.desc} (${gearBonusText(gear.bonus)})` : null;
                        const name = gear ? gear.name : itemDisplayName(id);
                        return (
                          <div key={id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate" title={gearHint ?? name}>
                                {name}
                              </div>
                              {gear && (
                                <div className="text-[11px] text-gray-600 truncate" title={gearHint ?? undefined}>
                                  {gearBonusText(gear.bonus)}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {gear && (
                                <button
                                  onClick={() => toggleEquip(id)}
                                  className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                                    equipped
                                      ? "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
                                      : "border-gray-800 text-gray-400 hover:text-white hover:border-gray-600"
                                  }`}
                                >
                                  {equipped ? "해제" : "장착"}
                                </button>
                              )}
                              <span className="text-gray-500">x{count}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:row-span-2 lg:col-start-2">
          {quests.length > 0 && (
            <div className="border border-gray-800 bg-surface/60 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-200 font-bold">
                  <FaClipboardList className="text-primary" />
                  <span>의뢰</span>
                </div>
                <div className="text-xs text-gray-600">
                  {quests.filter((q) => q.completed).length} / {quests.length}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {quests.slice(0, 6).map((q) => {
                  const ratio = q.target > 0 ? clamp(q.progress / q.target, 0, 1) : 0;
                  return (
                    <div
                      key={q.id}
                      className="border border-gray-800 bg-black/20 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-200 truncate">
                            {q.title}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {q.desc}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {q.progress}/{q.target}
                        </div>
                      </div>

                      <div className="mt-2 h-2 rounded bg-black/40 border border-gray-800 overflow-hidden">
                        <div
                          className={`h-2 ${q.completed ? "bg-emerald-500/70" : "bg-primary/60"}`}
                          style={{ width: `${Math.round(ratio * 100)}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-xs text-gray-500 inline-flex items-center gap-1">
                          <GiTwoCoins className="text-gray-400" aria-hidden />
                          <span>{q.reward.gold}G</span>
                        </div>
                        {q.completed && !q.claimed ? (
                          <button
                            onClick={() => claimQuest(q.id)}
                            className="text-xs px-2 py-1 rounded border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                          >
                            수령
                          </button>
                        ) : q.claimed ? (
                          <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
                            <FaCheckCircle aria-hidden />
                            수령 완료
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border border-gray-800 bg-surface/60 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="text-sm text-gray-300 font-bold">전투 로그</div>
              <div className="text-xs text-gray-600 text-right leading-snug">
                <div>
                  <span className="inline-flex items-center gap-1">
                    <GiTwoCoins className="text-gray-500" aria-hidden />
                    <span className="text-gray-500">던전</span>
                    <span className="text-gray-300">{hero.gold}</span>
                  </span>
                  {hero.goldDebt > 0 ? (
                    <span className="text-gray-500"> (상쇄 {hero.goldDebt}G)</span>
                  ) : null}
                </div>
                <div>
                  <span className="inline-flex items-center gap-1">
                    <FaTrophy className="text-amber-200" aria-hidden />
                    <span className="text-gray-500">정산(클리어)</span>
                    <span className="text-gray-300">{clearRewardPreview}</span>
                  </span>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1">
                    <FaCoins className="text-primary" aria-hidden />
                    <span className="text-gray-500">보유</span>
                    <span className="text-gray-300">{metaResources.gold}</span>
                  </span>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-gray-500">런</span>
                    <span className="text-gray-300">
                      턴 {runTelemetry.turnsTaken} · 가한 {runTelemetry.damageDealt} · 받은 {runTelemetry.damageTaken}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <div
              ref={logRef}
              onClick={skipTyping}
              title="클릭하면 로그가 즉시 출력됩니다."
              className="h-[220px] sm:h-[260px] overflow-y-auto px-4 py-3 text-sm text-gray-300 font-mono space-y-2"
            >
              {log.map((line, i) => {
                const typingNow = typing?.index === i && (typing?.pos ?? 0) < line.length;
                const shown = typing?.index === i ? line.slice(0, typing.pos) : line;
                return (
                  <motion.div
                    key={`${i}-${line}`}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="leading-relaxed"
                  >
                    <LogLine line={shown} />
                    {typingNow ? <span className="text-gray-600">▍</span> : null}
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="border border-gray-800 bg-surface/60 rounded-lg p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                커맨드
              </div>
            </div>
            {actionPanel}
          </div>

          <div className="border border-gray-800 bg-surface/60 rounded-lg p-4 lg:hidden">
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

              <div className="border border-gray-800 bg-black/20 rounded p-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500">위험도</span>
                  <span className={riskToneClass}>{riskState.label}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-black/50 border border-gray-800 overflow-hidden">
                  <div
                    className={`h-1.5 ${riskBarClass}`}
                    style={{ width: `${riskState.score}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-gray-600">{riskState.note}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <MiniStat label="LV" value={hero.level} />
                <MiniStat label="XP" value={`${hero.xp}/${xpToNext(hero.level)}`} />
                <MiniStat label="ATK" value={hero.atk} />
                <MiniStat label="DEF" value={hero.def} />
                <MiniStat label="SPD" value={hero.spd} />
                <MiniStat label="LUK" value={hero.luk} />
                <MiniStat label="GOLD" value={hero.gold} />
                <MiniStat label="정산" value={hero.rewardGold} />
                <MiniStat label="DEBT" value={hero.goldDebt} />
              </div>

              {hero.effects.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">효과</div>
                  <div className="flex flex-wrap gap-1">
                    {hero.effects.slice(0, 12).map((e, i) => (
                      <div
                        key={`m-${e.id}-${i}`}
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

              <div>
                <div className="text-xs text-gray-500 mb-2">장비</div>
                <div className="grid gap-1 text-xs text-gray-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">무기</span>
                    <span className="truncate text-gray-200">
                      {hero.equipment.weapon ? gearName(hero.equipment.weapon) : "없음"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">갑옷</span>
                    <span className="truncate text-gray-200">
                      {hero.equipment.armor ? gearName(hero.equipment.armor) : "없음"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">장신구</span>
                    <span className="truncate text-gray-200">
                      {hero.equipment.accessory ? gearName(hero.equipment.accessory) : "없음"}
                    </span>
                  </div>
                </div>
              </div>

              {Object.keys(hero.items).length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">가방</div>
                  <div className="grid gap-1 text-xs text-gray-300">
                    {Object.entries(hero.items)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .slice(0, 10)
                      .map(([id, count]) => {
                        const gear = isGearItemId(id) ? getGearDef(id) : null;
                        const equipped = gear ? hero.equipment[gear.slot] === id : false;
                        const gearHint =
                          gear ? `${gear.desc} (${gearBonusText(gear.bonus)})` : null;
                        const name = gear ? gear.name : itemDisplayName(id);
                        return (
                          <div key={`m-${id}`} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate" title={gearHint ?? name}>
                                {name}
                              </div>
                              {gear && (
                                <div className="text-[11px] text-gray-600 truncate" title={gearHint ?? undefined}>
                                  {gearBonusText(gear.bonus)}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {gear && (
                                <button
                                  onClick={() => toggleEquip(id)}
                                  className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                                    equipped
                                      ? "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
                                      : "border-gray-800 text-gray-400 hover:text-white hover:border-gray-600"
                                  }`}
                                >
                                  {equipped ? "해제" : "장착"}
                                </button>
                              )}
                              <span className="text-gray-500">x{count}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {phase === "CLEAR" && (
            <div className="border border-gray-800 bg-surface/60 rounded-lg p-5">
              <div className="flex items-center gap-2 text-gray-200 font-bold">
                <FaTrophy className="text-primary" />
                <span>클리어</span>
              </div>
              <div className="mt-2 text-gray-500">
                정산: 보유 골드 +{" "}
                <span className="text-gray-200">{clearRewardPreview}</span>
              </div>
              <div className="mt-1 text-xs text-gray-600">
                던전에서 얻은 아이템과 강화는 소멸합니다.
              </div>
              <div className="mt-4 border border-gray-800 bg-black/20 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">런 요약</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="소요 시간" value={`${runSummary.durationSec}s`} />
                  <MiniStat label="진행률" value={`${Math.round(runSummary.roomProgressRate * 100)}%`} />
                  <MiniStat label="턴 수" value={runTelemetry.turnsTaken} />
                  <MiniStat label="전투 승률" value={`${Math.round(runSummary.combatWinRate * 100)}%`} />
                  <MiniStat label="가한 피해" value={runTelemetry.damageDealt} />
                  <MiniStat label="받은 피해" value={runTelemetry.damageTaken} />
                  <MiniStat label="획득 골드" value={runTelemetry.goldEarned} />
                  <MiniStat label="순골드" value={runSummary.netGold} />
                </div>
              </div>
            </div>
          )}

          {phase === "DEAD" && (
            <div className="border border-gray-800 bg-surface/60 rounded-lg p-5">
              <div className="flex items-center gap-2 text-gray-200 font-bold">
                <FaSkull className="text-red-400" />
                <span>실패</span>
              </div>
              <div className="mt-2 text-gray-500">이번 탐험은 끝났습니다.</div>
              <div className="mt-1 text-xs text-gray-600">
                위로금: 보유 골드 +{" "}
                <span className="text-gray-300">{failRewardPreview}</span>
              </div>
              <div className="mt-1 text-xs text-gray-600">
                던전 골드/아이템/강화는 소멸합니다.
              </div>
              <div className="mt-4 border border-gray-800 bg-black/20 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">런 요약</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="소요 시간" value={`${runSummary.durationSec}s`} />
                  <MiniStat label="진행률" value={`${Math.round(runSummary.roomProgressRate * 100)}%`} />
                  <MiniStat label="턴 수" value={runTelemetry.turnsTaken} />
                  <MiniStat label="도주 성공률" value={`${Math.round(runSummary.fleeSuccessRate * 100)}%`} />
                  <MiniStat label="가한 피해" value={runTelemetry.damageDealt} />
                  <MiniStat label="받은 피해" value={runTelemetry.damageTaken} />
                  <MiniStat label="위기 보정" value={runTelemetry.pityDrops} />
                  <MiniStat label="이벤트 성공" value={`${Math.round(runSummary.eventSuccessRate * 100)}%`} />
                </div>
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

              <div className="mt-4 border border-gray-800 bg-black/20 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-200 font-bold">AI 판정</div>
                    <div className="mt-1 text-xs text-gray-600">
                      이벤트/함정/선택지의 결과를 AI가 보조합니다.
                    </div>
                  </div>
                  <div
                    className={`text-xs px-3 py-2 rounded border whitespace-nowrap ${
                      !ENABLE_AI_ADJUDICATION
                        ? "border-gray-800 text-gray-600"
                        : canUseAI
                          ? "border-primary/40 text-primary bg-primary/5"
                          : "border-gray-800 text-gray-400"
                    }`}
                    title={
                      !ENABLE_AI_ADJUDICATION
                        ? "개발자 설정으로 비활성화됨"
                        : canUseAI
                          ? "AI 판정 사용 중"
                          : "Gemini API 키가 필요합니다"
                    }
                  >
                    {!ENABLE_AI_ADJUDICATION ? "비활성" : canUseAI ? "사용" : "키 없음"}
                  </div>
                </div>
                {!geminiApiKey && (
                  <div className="mt-2 text-xs text-gray-600">
                    설정된 Gemini API 키가 없어 AI 판정은 사용할 수 없습니다.
                  </div>
                )}
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
