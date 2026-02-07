import type { Difficulty } from "@/types/builder";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export type RunTelemetry = {
  startedAtMs: number;
  roomsVisited: number;
  combatsStarted: number;
  combatsWon: number;
  turnsTaken: number;
  playerActions: number;
  enemyActions: number;
  enemyKills: number;
  criticalHits: number;
  damageDealt: number;
  damageTaken: number;
  hpRecovered: number;
  mpRecovered: number;
  trapsTriggered: number;
  trapAttempts: number;
  trapsDisarmed: number;
  eventsResolved: number;
  eventSuccess: number;
  fleeAttempts: number;
  fleeSuccess: number;
  goldEarned: number;
  goldSpent: number;
  debtPaid: number;
  xpEarned: number;
  itemsEarned: number;
  itemsUsed: number;
  questsClaimed: number;
  pityDrops: number;
};

type RunCounterKey = Exclude<keyof RunTelemetry, "startedAtMs">;
export type RunTelemetryDelta = Partial<Record<RunCounterKey, number>>;

const RUN_COUNTER_KEYS: RunCounterKey[] = [
  "roomsVisited",
  "combatsStarted",
  "combatsWon",
  "turnsTaken",
  "playerActions",
  "enemyActions",
  "enemyKills",
  "criticalHits",
  "damageDealt",
  "damageTaken",
  "hpRecovered",
  "mpRecovered",
  "trapsTriggered",
  "trapAttempts",
  "trapsDisarmed",
  "eventsResolved",
  "eventSuccess",
  "fleeAttempts",
  "fleeSuccess",
  "goldEarned",
  "goldSpent",
  "debtPaid",
  "xpEarned",
  "itemsEarned",
  "itemsUsed",
  "questsClaimed",
  "pityDrops",
];

export function createRunTelemetry(nowMs = Date.now()): RunTelemetry {
  return {
    startedAtMs: nowMs,
    roomsVisited: 0,
    combatsStarted: 0,
    combatsWon: 0,
    turnsTaken: 0,
    playerActions: 0,
    enemyActions: 0,
    enemyKills: 0,
    criticalHits: 0,
    damageDealt: 0,
    damageTaken: 0,
    hpRecovered: 0,
    mpRecovered: 0,
    trapsTriggered: 0,
    trapAttempts: 0,
    trapsDisarmed: 0,
    eventsResolved: 0,
    eventSuccess: 0,
    fleeAttempts: 0,
    fleeSuccess: 0,
    goldEarned: 0,
    goldSpent: 0,
    debtPaid: 0,
    xpEarned: 0,
    itemsEarned: 0,
    itemsUsed: 0,
    questsClaimed: 0,
    pityDrops: 0,
  };
}

export function applyRunTelemetryDelta(
  prev: RunTelemetry,
  delta: RunTelemetryDelta,
): RunTelemetry {
  const next: RunTelemetry = { ...prev };
  for (const key of RUN_COUNTER_KEYS) {
    const raw = delta[key];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw === 0) continue;
    const cur = prev[key];
    next[key] = Math.max(0, cur + raw);
  }
  return next;
}

type RunOutcome = "CLEAR" | "DEAD";

export type RunTelemetrySummary = {
  durationSec: number;
  netGold: number;
  avgDamagePerTurn: number;
  avgTakenPerTurn: number;
  combatWinRate: number;
  eventSuccessRate: number;
  fleeSuccessRate: number;
  roomProgressRate: number;
};

export function summarizeRunTelemetry(
  run: RunTelemetry,
  input: {
    outcome: RunOutcome;
    finalRoom: number;
    totalRooms: number;
    nowMs?: number;
  },
): RunTelemetrySummary {
  const nowMs = input.nowMs ?? Date.now();
  const elapsed = Math.max(1, nowMs - run.startedAtMs);
  const turns = Math.max(1, run.turnsTaken);
  const combats = Math.max(0, run.combatsStarted);
  const events = Math.max(0, run.eventsResolved);
  const flees = Math.max(0, run.fleeAttempts);
  const totalRooms = Math.max(1, input.totalRooms);
  const finalRoom = clamp(input.finalRoom, 0, totalRooms);

  const baseProgress = finalRoom / totalRooms;
  const clearBonus = input.outcome === "CLEAR" ? 0.05 : 0;

  return {
    durationSec: Math.round(elapsed / 1000),
    netGold: run.goldEarned - run.goldSpent,
    avgDamagePerTurn: Math.round((run.damageDealt / turns) * 10) / 10,
    avgTakenPerTurn: Math.round((run.damageTaken / turns) * 10) / 10,
    combatWinRate: combats > 0 ? run.combatsWon / combats : 0,
    eventSuccessRate: events > 0 ? run.eventSuccess / events : 0,
    fleeSuccessRate: flees > 0 ? run.fleeSuccess / flees : 0,
    roomProgressRate: clamp(baseProgress + clearBonus, 0, 1),
  };
}

export type RunRiskTone = "STABLE" | "CAUTION" | "DANGER" | "CRITICAL";

export type RunRiskState = {
  score: number;
  tone: RunRiskTone;
  label: string;
  note: string;
};

export function assessRunRisk(input: {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  effectsCount: number;
  goldDebt: number;
  starterGold: number;
  potionCount: number;
  progressRatio: number;
  inCombat: boolean;
  enemyPressure: number;
}): RunRiskState {
  const hpRatio = input.maxHp > 0 ? clamp(input.hp / input.maxHp, 0, 1) : 0;
  const mpRatio = input.maxMp > 0 ? clamp(input.mp / input.maxMp, 0, 1) : 0;
  const debtRatio =
    input.starterGold > 0 ? clamp(input.goldDebt / input.starterGold, 0, 2) : 0;
  const progress = clamp(input.progressRatio, 0, 1);
  const enemyPressure = clamp(input.enemyPressure, 0, 1);

  let score = 0;
  if (hpRatio <= 0.2) score += 56;
  else if (hpRatio <= 0.35) score += 42;
  else if (hpRatio <= 0.5) score += 28;
  else if (hpRatio <= 0.7) score += 14;

  if (mpRatio <= 0.2) score += 10;
  else if (mpRatio <= 0.4) score += 6;

  score += Math.min(16, input.effectsCount * 3);
  score += Math.round(debtRatio * 10);

  if (input.potionCount <= 0) score += 8;
  if (input.inCombat) score += Math.round(enemyPressure * 16);

  // Late run risk should be interpreted slightly higher.
  score += Math.round(progress * 6);
  score = clamp(score, 0, 100);

  if (score >= 76) {
    return {
      score,
      tone: "CRITICAL",
      label: "치명적 위기",
      note: "생존 우선. 회복/도주/방어를 고려하세요.",
    };
  }
  if (score >= 56) {
    return {
      score,
      tone: "DANGER",
      label: "고위험",
      note: "리스크 관리가 필요합니다.",
    };
  }
  if (score >= 34) {
    return {
      score,
      tone: "CAUTION",
      label: "주의",
      note: "무리한 교환을 피하세요.",
    };
  }
  return {
    score,
    tone: "STABLE",
    label: "안정",
    note: "공격적 선택도 가능합니다.",
  };
}

export type AdaptiveConsumableBoost = {
  bonusChance: number;
  active: boolean;
  note: string;
};

const DIFFICULTY_PITY_WEIGHT: Record<Difficulty, number> = {
  EASY: 0,
  NORMAL: 0.01,
  HARD: 0.02,
  NIGHTMARE: 0.03,
};

export function getAdaptiveConsumableDropBoost(input: {
  difficulty: Difficulty;
  hp: number;
  maxHp: number;
  potionCount: number;
  progressRatio: number;
  recentDamageTaken: number;
}): AdaptiveConsumableBoost {
  const hpRatio = input.maxHp > 0 ? clamp(input.hp / input.maxHp, 0, 1) : 0;
  const progress = clamp(input.progressRatio, 0, 1);
  let bonus = DIFFICULTY_PITY_WEIGHT[input.difficulty];
  const reasons: string[] = [];

  if (hpRatio <= 0.2) {
    bonus += 0.18;
    reasons.push("치명적 체력");
  } else if (hpRatio <= 0.35) {
    bonus += 0.12;
    reasons.push("낮은 체력");
  } else if (hpRatio <= 0.5) {
    bonus += 0.07;
  }

  if (input.potionCount <= 0) {
    bonus += 0.06;
    reasons.push("포션 고갈");
  }

  if (input.recentDamageTaken >= Math.max(24, Math.round(input.maxHp * 0.2))) {
    bonus += 0.05;
    reasons.push("최근 큰 피해");
  }

  if (progress >= 0.6) bonus += 0.03;

  bonus = clamp(bonus, 0, 0.3);
  return {
    bonusChance: bonus,
    active: bonus >= 0.09,
    note: reasons.length > 0 ? reasons.join(", ") : "기본 상태",
  };
}
