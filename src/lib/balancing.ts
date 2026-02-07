import type { Difficulty } from "@/types/builder";
import type { CardData, CardGrade, CardReward } from "@/types/card";

export type CombatStatBlock = {
  hp: number;
  atk: number;
  def: number;
  spd: number;
};

export type RewardSource = "COMBAT" | "CHEST" | "BOSS";
export type GearDropSource = RewardSource;

export type TraderPriceProfile = {
  potion: number;
  tool: number;
  smoke: number;
  gear: number;
};

export type EventChoiceProfile = {
  dc: number;
  successGold: number;
  failHpRatio: number;
};

export type NpcTalkBalance = {
  xp: number;
  gold: number;
  infoCost: number;
  intimidateDc: number;
  intimidateGold: number;
  intimidateFailHpRatio: number;
  intimidateXpMultiplier: number;
  intimidateFailXpMultiplier: number;
  infoXpMultiplier: number;
};

export type NpcQuestBalance = {
  rewardBaseGold: number;
  killTarget: number;
  chestRewardMultiplier: number;
  killRewardMultiplier: number;
  reachEndRewardMultiplier: number;
};

export const ROOM_COUNT_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 15,
  NORMAL: 25,
  HARD: 40,
  NIGHTMARE: 50,
};

// Start-of-run dungeon gold. Harder tiers grant more initial flexibility,
// but the relative gain is kept sub-linear to avoid trivializing risk.
export const START_GOLD_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 110,
  NORMAL: 150,
  HARD: 205,
  NIGHTMARE: 270,
};

// Clear/failure settlement rewards granted after run end.
export const CLEAR_REWARD_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 70,
  NORMAL: 100,
  HARD: 145,
  NIGHTMARE: 205,
};

export const FAILURE_REWARD_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 20,
  NORMAL: 26,
  HARD: 36,
  NIGHTMARE: 50,
};

// Chance that non-instant trap room triggers on entry.
export const TRAP_TRIGGER_RATE: Record<Difficulty, number> = {
  EASY: 0.28,
  NORMAL: 0.46,
  HARD: 0.63,
  NIGHTMARE: 0.79,
};

export const SHRINE_GUARDIAN_STATS: Record<Difficulty, CombatStatBlock> = {
  EASY: { hp: 90, atk: 10, def: 3, spd: 11 },
  NORMAL: { hp: 130, atk: 16, def: 5, spd: 12 },
  HARD: { hp: 178, atk: 23, def: 7, spd: 13 },
  NIGHTMARE: { hp: 248, atk: 32, def: 10, spd: 14 },
};

export const DIFFICULTY_SETUP_HINT: Record<Difficulty, string> = {
  EASY: "입문 난이도. 비교적 낮은 리스크와 안정적인 진행.",
  NORMAL: "표준 밸런스. 위험과 보상이 균형 잡힌 진행.",
  HARD: "고난도. 함정/적의 압박이 커지고 의사결정이 중요합니다.",
  NIGHTMARE: "최고 난이도. 큰 리스크를 감수하고 높은 보상을 노립니다.",
};

export const ENEMY_SQUAD_COUNT_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 2,
  NORMAL: 3,
  HARD: 3,
  NIGHTMARE: 4,
};

export const SMITHY_UPGRADE_COST_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 75,
  NORMAL: 110,
  HARD: 145,
  NIGHTMARE: 195,
};

export const SHRINE_TIME_PENALTY_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 28,
  NORMAL: 50,
  HARD: 72,
  NIGHTMARE: 108,
};

export const TRADER_PRICE_PROFILE_BY_DIFFICULTY: Record<Difficulty, TraderPriceProfile> =
  {
    EASY: { potion: 30, tool: 55, smoke: 75, gear: 95 },
    NORMAL: { potion: 36, tool: 68, smoke: 94, gear: 128 },
    HARD: { potion: 44, tool: 82, smoke: 116, gear: 176 },
    NIGHTMARE: { potion: 56, tool: 104, smoke: 146, gear: 238 },
  };

export const EVENT_CHOICE_PROFILE_BY_DIFFICULTY: Record<Difficulty, EventChoiceProfile> = {
  EASY: { dc: 11, successGold: 30, failHpRatio: 0.05 },
  NORMAL: { dc: 14, successGold: 45, failHpRatio: 0.08 },
  HARD: { dc: 17, successGold: 63, failHpRatio: 0.11 },
  NIGHTMARE: { dc: 20, successGold: 86, failHpRatio: 0.15 },
};

export const NPC_TALK_BALANCE_BY_DIFFICULTY: Record<Difficulty, NpcTalkBalance> = {
  EASY: {
    xp: 11,
    gold: 10,
    infoCost: 20,
    intimidateDc: 12,
    intimidateGold: 42,
    intimidateFailHpRatio: 0.065,
    intimidateXpMultiplier: 0.5,
    intimidateFailXpMultiplier: 0.35,
    infoXpMultiplier: 0.4,
  },
  NORMAL: {
    xp: 15,
    gold: 14,
    infoCost: 28,
    intimidateDc: 14,
    intimidateGold: 58,
    intimidateFailHpRatio: 0.09,
    intimidateXpMultiplier: 0.5,
    intimidateFailXpMultiplier: 0.35,
    infoXpMultiplier: 0.4,
  },
  HARD: {
    xp: 20,
    gold: 20,
    infoCost: 36,
    intimidateDc: 16,
    intimidateGold: 82,
    intimidateFailHpRatio: 0.11,
    intimidateXpMultiplier: 0.5,
    intimidateFailXpMultiplier: 0.35,
    infoXpMultiplier: 0.4,
  },
  NIGHTMARE: {
    xp: 27,
    gold: 26,
    infoCost: 46,
    intimidateDc: 18,
    intimidateGold: 114,
    intimidateFailHpRatio: 0.14,
    intimidateXpMultiplier: 0.5,
    intimidateFailXpMultiplier: 0.35,
    infoXpMultiplier: 0.4,
  },
};

export const NPC_QUEST_BALANCE_BY_DIFFICULTY: Record<Difficulty, NpcQuestBalance> = {
  EASY: {
    rewardBaseGold: 95,
    killTarget: 2,
    chestRewardMultiplier: 0.9,
    killRewardMultiplier: 1.1,
    reachEndRewardMultiplier: 1.4,
  },
  NORMAL: {
    rewardBaseGold: 125,
    killTarget: 3,
    chestRewardMultiplier: 0.9,
    killRewardMultiplier: 1.1,
    reachEndRewardMultiplier: 1.4,
  },
  HARD: {
    rewardBaseGold: 160,
    killTarget: 4,
    chestRewardMultiplier: 0.9,
    killRewardMultiplier: 1.1,
    reachEndRewardMultiplier: 1.4,
  },
  NIGHTMARE: {
    rewardBaseGold: 230,
    killTarget: 5,
    chestRewardMultiplier: 0.9,
    killRewardMultiplier: 1.1,
    reachEndRewardMultiplier: 1.4,
  },
};

const TRAP_DAMAGE_RATIO_BASE_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 0.08,
  NORMAL: 0.12,
  HARD: 0.16,
  NIGHTMARE: 0.22,
};

const PROGRESS_RISK_END_MULTIPLIER: Record<Difficulty, number> = {
  EASY: 1.15,
  NORMAL: 1.22,
  HARD: 1.28,
  NIGHTMARE: 1.34,
};

const PROGRESS_REWARD_START_MULTIPLIER: Record<Difficulty, number> = {
  EASY: 0.95,
  NORMAL: 0.95,
  HARD: 0.93,
  NIGHTMARE: 0.92,
};

const PROGRESS_REWARD_END_MULTIPLIER: Record<Difficulty, number> = {
  EASY: 1.1,
  NORMAL: 1.18,
  HARD: 1.24,
  NIGHTMARE: 1.3,
};

const FALLBACK_REWARD_BASE: Record<Difficulty, Record<RewardSource, number>> = {
  EASY: { COMBAT: 40, CHEST: 55, BOSS: 90 },
  NORMAL: { COMBAT: 45, CHEST: 65, BOSS: 110 },
  HARD: { COMBAT: 55, CHEST: 80, BOSS: 140 },
  NIGHTMARE: { COMBAT: 75, CHEST: 110, BOSS: 200 },
};

const FALLBACK_CONSUMABLE_DROP_BASE_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 0.2,
  NORMAL: 0.21,
  HARD: 0.23,
  NIGHTMARE: 0.25,
};

const GEAR_DROP_BASE_BY_DIFFICULTY: Record<
  Difficulty,
  Record<GearDropSource, number>
> = {
  EASY: { COMBAT: 0.09, CHEST: 0.28, BOSS: 0.72 },
  NORMAL: { COMBAT: 0.11, CHEST: 0.33, BOSS: 0.78 },
  HARD: { COMBAT: 0.13, CHEST: 0.38, BOSS: 0.84 },
  NIGHTMARE: { COMBAT: 0.15, CHEST: 0.45, BOSS: 0.9 },
};

const COMBAT_XP_BASE_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 14,
  NORMAL: 20,
  HARD: 27,
  NIGHTMARE: 36,
};

const COMBAT_XP_GRADE_MULTIPLIER: Record<CardGrade, number> = {
  NORMAL: 1,
  ELITE: 1.55,
  EPIC: 1.9,
  LEGENDARY: 2.25,
  BOSS: 3,
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function progress01(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return clamp(progress, 0, 1);
}

export function getProgressRiskMultiplier(
  difficulty: Difficulty,
  progress: number,
): number {
  const t = progress01(progress);
  return lerp(1, PROGRESS_RISK_END_MULTIPLIER[difficulty], t);
}

export function getProgressRewardMultiplier(
  difficulty: Difficulty,
  progress: number,
): number {
  const t = progress01(progress);
  return lerp(
    PROGRESS_REWARD_START_MULTIPLIER[difficulty],
    PROGRESS_REWARD_END_MULTIPLIER[difficulty],
    t,
  );
}

export function getTrapDamageRatio(difficulty: Difficulty, progress: number): number {
  const base = TRAP_DAMAGE_RATIO_BASE_BY_DIFFICULTY[difficulty];
  const mul = getProgressRiskMultiplier(difficulty, progress);
  return clamp(base * mul, 0.04, 0.36);
}

export function getFallbackRewardGold(
  difficulty: Difficulty,
  source: RewardSource,
  progress: number,
): number {
  const base = FALLBACK_REWARD_BASE[difficulty][source];
  const scaled = base * getProgressRewardMultiplier(difficulty, progress);
  return Math.max(1, Math.round(scaled));
}

export function calcDamage(atk: number, def: number, mul = 1, reduction = 1): number {
  const safeAtk = Number.isFinite(atk) ? Math.max(0, atk) : 0;
  const safeDef = Number.isFinite(def) ? Math.max(0, def) : 0;
  const safeMul = Number.isFinite(mul) ? Math.max(0, mul) : 1;
  const safeReduction = Number.isFinite(reduction) ? reduction : 1;
  const raw = safeAtk * safeMul - safeDef * 0.45;
  const preReduction = Math.max(1, Math.round(raw));
  return Math.max(0, Math.round(preReduction * clamp(safeReduction, 0, 2)));
}

export function calcCritChance(luk: number): number {
  const safeLuk = Number.isFinite(luk) ? Math.max(0, luk) : 0;
  return clamp(0.04 + (safeLuk - 10) * 0.0045, 0.04, 0.3);
}

export function calcFleeChance(heroSpd: number, enemySpd: number): number {
  const mySpd = Number.isFinite(heroSpd) ? heroSpd : 0;
  const targetSpd = Number.isFinite(enemySpd) ? enemySpd : 0;
  return clamp(0.32 + (mySpd - targetSpd) * 0.019, 0.12, 0.82);
}

export function calcStatusResistChance(luk: number): number {
  const safeLuk = Number.isFinite(luk) ? Math.max(0, luk) : 0;
  return clamp(0.06 + (safeLuk - 10) * 0.009, 0.02, 0.38);
}

export function xpToNext(level: number): number {
  const lv = Math.max(1, Math.round(level));
  const t = lv - 1;
  return Math.max(60, Math.round(60 + t * 28 + t * t * 2.4));
}

export function goldFromReward(rewards: CardReward | undefined): number {
  if (!rewards?.gold) return 0;
  if (typeof rewards.gold === "number") return Math.max(0, Math.round(rewards.gold));
  const min = Math.round(rewards.gold.min);
  const max = Math.round(rewards.gold.max);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

export function itemsFromReward(rewards: CardReward | undefined): string[] {
  if (!rewards?.items || !Array.isArray(rewards.items)) return [];
  const out: string[] = [];
  for (const raw of rewards.items) {
    if (typeof raw === "string") {
      const id = raw.trim().toUpperCase();
      if (id) out.push(id);
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id.trim().toUpperCase() : "";
    if (!id) continue;
    const rate =
      typeof obj.rate === "number" && Number.isFinite(obj.rate) ? obj.rate : 1;
    if (Math.random() <= clamp(rate, 0, 1)) out.push(id);
  }
  return out;
}

function isCombatCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return category.includes("ENEMY") || category.includes("BOSS");
}

function normalizedCardGrade(grade: string | null | undefined): CardGrade {
  switch (grade) {
    case "ELITE":
    case "BOSS":
    case "EPIC":
    case "LEGENDARY":
      return grade;
    default:
      return "NORMAL";
  }
}

export function xpFromCard(
  card: CardData,
  difficulty: Difficulty,
  progress = 0,
): number {
  const explicit = card.rewards?.xp;
  if (typeof explicit === "number" && Number.isFinite(explicit))
    return Math.max(0, Math.round(explicit));

  if (!isCombatCategory(card.category)) return 0;

  const grade = normalizedCardGrade(card.grade);
  const base = COMBAT_XP_BASE_BY_DIFFICULTY[difficulty];
  const gradeMul = COMBAT_XP_GRADE_MULTIPLIER[grade];
  const progressMul = lerp(0.94, 1.2, progress01(progress));

  return Math.max(0, Math.round(base * gradeMul * progressMul));
}

export function getEventChoiceProfile(
  difficulty: Difficulty,
  explicitDc?: number | null,
): EventChoiceProfile {
  const base = EVENT_CHOICE_PROFILE_BY_DIFFICULTY[difficulty];
  const safeExplicitDc =
    typeof explicitDc === "number" && Number.isFinite(explicitDc) ? explicitDc : null;
  const dc = safeExplicitDc !== null ? Math.round(clamp(safeExplicitDc, 8, 30)) : base.dc;
  return { ...base, dc };
}

export function getShrineTimePenalty(
  difficulty: Difficulty,
  explicitValue?: number | null,
): number {
  if (typeof explicitValue === "number" && Number.isFinite(explicitValue))
    return Math.max(1, Math.round(explicitValue));
  return SHRINE_TIME_PENALTY_BY_DIFFICULTY[difficulty];
}

export function getEnemySquadCount(difficulty: Difficulty): number {
  return ENEMY_SQUAD_COUNT_BY_DIFFICULTY[difficulty];
}

export function getSmithyUpgradeCost(difficulty: Difficulty): number {
  return SMITHY_UPGRADE_COST_BY_DIFFICULTY[difficulty];
}

export function getTraderBasePriceProfile(difficulty: Difficulty): TraderPriceProfile {
  return TRADER_PRICE_PROFILE_BY_DIFFICULTY[difficulty];
}

export function getNpcTalkBalance(difficulty: Difficulty): NpcTalkBalance {
  return NPC_TALK_BALANCE_BY_DIFFICULTY[difficulty];
}

export function getNpcQuestBalance(difficulty: Difficulty): NpcQuestBalance {
  return NPC_QUEST_BALANCE_BY_DIFFICULTY[difficulty];
}

export function getGearDropChance(
  difficulty: Difficulty,
  source: GearDropSource,
  progress: number,
  ownedGearCount: number,
): number {
  const base = GEAR_DROP_BASE_BY_DIFFICULTY[difficulty][source];
  const t = progress01(progress);
  const progressMul = lerp(0.92, difficulty === "NIGHTMARE" ? 1.22 : 1.16, t);
  const ownershipMul =
    ownedGearCount <= 0 ? 1 : ownedGearCount === 1 ? 0.62 : ownedGearCount === 2 ? 0.42 : 0.32;
  return clamp(base * progressMul * ownershipMul, 0, 0.96);
}

export function getFallbackConsumableDropChance(
  difficulty: Difficulty,
  progress: number,
): number {
  const base = FALLBACK_CONSUMABLE_DROP_BASE_BY_DIFFICULTY[difficulty];
  return clamp(base + progress01(progress) * 0.12, 0.08, 0.48);
}
