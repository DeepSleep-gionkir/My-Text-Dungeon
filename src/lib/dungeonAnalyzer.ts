import type { Difficulty } from "@/types/builder";
import type { CardCategory, CardData } from "@/types/card";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export type AnalysisSeverity = "INFO" | "WARN" | "ERROR";

export type DungeonValidationIssue = {
  code: string;
  severity: AnalysisSeverity;
  message: string;
  hint?: string;
  stepIndex?: number;
  slotIndex?: number;
};

export type SlotAnalysis = {
  stepIndex: number;
  slotIndex: number;
  category: CardCategory;
  name: string;
  risk: number;
  reward: number;
  sustain: number;
  flags: string[];
};

export type DungeonAnalysisSummary = {
  avgRisk: number;
  peakRisk: number;
  avgReward: number;
  avgSustain: number;
  branchDensity: number;
  combatDensity: number;
  trapDensity: number;
  restDensity: number;
  estimatedClearRate: number;
  calibratedClearRate: number;
  empiricalRuns: number;
  empiricalClearRate: number | null;
  empiricalCombatWinRate: number | null;
  estimatedRunMinutesMin: number;
  estimatedRunMinutesMax: number;
  calibratedRunMinutesMin: number;
  calibratedRunMinutesMax: number;
};

export type DungeonAnalysisResult = {
  slots: SlotAnalysis[];
  heatmapByStep: number[];
  issues: DungeonValidationIssue[];
  summary: DungeonAnalysisSummary;
};

export type BuilderStepInput =
  | { kind: "SINGLE"; slots: [CardData | null] }
  | { kind: "FORK"; slots: [CardData | null, CardData | null] };

export type DungeonEmpiricalInput = {
  runs: number;
  clears: number;
  fails: number;
  totalProgressRate: number;
  totalDurationSec: number;
  totalTurns: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalCombats: number;
  totalCombatWins: number;
};

const BASE_RISK_BY_CATEGORY: Record<CardCategory, number> = {
  CARD_ENEMY_SINGLE: 58,
  CARD_ENEMY_SQUAD: 66,
  CARD_BOSS: 90,
  CARD_TRAP_INSTANT: 63,
  CARD_TRAP_ROOM: 56,
  CARD_LOOT_CHEST: 20,
  CARD_SHRINE: 34,
  CARD_EVENT_CHOICE: 30,
  CARD_NPC_TRADER: 14,
  CARD_NPC_QUEST: 18,
  CARD_NPC_TALK: 16,
  CARD_REST_CAMPFIRE: 8,
  CARD_REST_SMITHY: 12,
  CARD_REST_STATUE: 10,
};

const BASE_REWARD_BY_CATEGORY: Record<CardCategory, number> = {
  CARD_ENEMY_SINGLE: 44,
  CARD_ENEMY_SQUAD: 50,
  CARD_BOSS: 82,
  CARD_TRAP_INSTANT: 22,
  CARD_TRAP_ROOM: 26,
  CARD_LOOT_CHEST: 74,
  CARD_SHRINE: 58,
  CARD_EVENT_CHOICE: 42,
  CARD_NPC_TRADER: 47,
  CARD_NPC_QUEST: 52,
  CARD_NPC_TALK: 38,
  CARD_REST_CAMPFIRE: 34,
  CARD_REST_SMITHY: 30,
  CARD_REST_STATUE: 36,
};

const BASE_SUSTAIN_BY_CATEGORY: Record<CardCategory, number> = {
  CARD_ENEMY_SINGLE: 18,
  CARD_ENEMY_SQUAD: 16,
  CARD_BOSS: 8,
  CARD_TRAP_INSTANT: 10,
  CARD_TRAP_ROOM: 12,
  CARD_LOOT_CHEST: 26,
  CARD_SHRINE: 34,
  CARD_EVENT_CHOICE: 30,
  CARD_NPC_TRADER: 28,
  CARD_NPC_QUEST: 22,
  CARD_NPC_TALK: 32,
  CARD_REST_CAMPFIRE: 76,
  CARD_REST_SMITHY: 52,
  CARD_REST_STATUE: 64,
};

const CLEAR_RATE_BASE_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 0.72,
  NORMAL: 0.56,
  HARD: 0.37,
  NIGHTMARE: 0.22,
};

const TARGET_RISK_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 42,
  NORMAL: 52,
  HARD: 62,
  NIGHTMARE: 72,
};

const TARGET_STEP_TIME_SEC_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 22,
  NORMAL: 25,
  HARD: 29,
  NIGHTMARE: 33,
};

const COMBAT_CATEGORIES = new Set<CardCategory>([
  "CARD_ENEMY_SINGLE",
  "CARD_ENEMY_SQUAD",
  "CARD_BOSS",
]);

const TRAP_CATEGORIES = new Set<CardCategory>([
  "CARD_TRAP_INSTANT",
  "CARD_TRAP_ROOM",
]);

const REST_CATEGORIES = new Set<CardCategory>([
  "CARD_REST_CAMPFIRE",
  "CARD_REST_SMITHY",
  "CARD_REST_STATUE",
]);

function statRiskScore(card: CardData, difficulty: Difficulty): number {
  if (!card.stats) return 0;
  const s = card.stats;
  const baseline =
    difficulty === "EASY"
      ? { hp: 70, atk: 8, def: 2, spd: 10 }
      : difficulty === "HARD"
        ? { hp: 130, atk: 18, def: 6, spd: 12 }
        : difficulty === "NIGHTMARE"
          ? { hp: 180, atk: 26, def: 8, spd: 13 }
          : { hp: 95, atk: 12, def: 4, spd: 11 };

  const offense = s.atk * 1.4 + s.spd * 0.55;
  const defense = s.hp * 0.09 + s.def * 1.9;
  const baselineOffense = baseline.atk * 1.4 + baseline.spd * 0.55;
  const baselineDefense = baseline.hp * 0.09 + baseline.def * 1.9;
  const ratio = (offense + defense) / Math.max(1, baselineOffense + baselineDefense);
  return clamp(Math.round((ratio - 1) * 22), -14, 24);
}

function tagRiskModifier(card: CardData): number {
  const tags = card.tags ?? [];
  let score = 0;
  for (const t of tags) {
    if (t.startsWith("IMMUNE_")) score += 3;
    else if (t.startsWith("RESIST_")) score += 2;
    else if (t.startsWith("WEAK_")) score -= 1;
    if (t === "TAG_ELITE") score += 6;
    if (t === "TAG_UNDEAD") score += 1;
    if (t === "TAG_CONSTRUCT") score += 1;
  }
  const statusAttrs = tags.filter((t) =>
    t === "ATTR_FIRE" ||
    t === "ATTR_ICE" ||
    t === "ATTR_POISON" ||
    t === "ATTR_DARK" ||
    t === "ATTR_LIGHTNING",
  );
  score += Math.min(8, statusAttrs.length * 2);
  return clamp(score, -8, 14);
}

function rewardModifier(card: CardData): number {
  const rewards = card.rewards;
  if (!rewards) return 0;
  let score = 0;
  const gold = rewards.gold;
  if (typeof gold === "number") {
    score += clamp(Math.round(gold / 30), 0, 12);
  } else if (gold && typeof gold === "object") {
    const min = Number.isFinite(gold.min) ? gold.min : 0;
    const max = Number.isFinite(gold.max) ? gold.max : min;
    score += clamp(Math.round((min + max) / 70), 0, 14);
  }
  if (typeof rewards.xp === "number" && Number.isFinite(rewards.xp)) {
    score += clamp(Math.round(rewards.xp / 22), 0, 12);
  }
  if (Array.isArray(rewards.items)) {
    score += clamp(rewards.items.length * 2, 0, 12);
  }
  return clamp(score, 0, 28);
}

function makeSlotAnalysis(
  card: CardData,
  difficulty: Difficulty,
  stepIndex: number,
  slotIndex: number,
): SlotAnalysis {
  const risk =
    BASE_RISK_BY_CATEGORY[card.category] +
    statRiskScore(card, difficulty) +
    tagRiskModifier(card);
  const reward = BASE_REWARD_BY_CATEGORY[card.category] + rewardModifier(card);
  const sustain = BASE_SUSTAIN_BY_CATEGORY[card.category];

  const flags: string[] = [];
  if (risk >= 84) flags.push("고위험");
  if (reward >= 82) flags.push("고보상");
  if (sustain >= 60) flags.push("회복구간");
  if (TRAP_CATEGORIES.has(card.category)) flags.push("함정");
  if (COMBAT_CATEGORIES.has(card.category)) flags.push("전투");
  if (card.category === "CARD_BOSS") flags.push("보스");

  return {
    stepIndex,
    slotIndex,
    category: card.category,
    name: card.name,
    risk: clamp(Math.round(risk), 0, 100),
    reward: clamp(Math.round(reward), 0, 100),
    sustain: clamp(Math.round(sustain), 0, 100),
    flags,
  };
}

function countSeverity(issues: DungeonValidationIssue[], severity: AnalysisSeverity): number {
  return issues.reduce((acc, it) => acc + (it.severity === severity ? 1 : 0), 0);
}

function finiteNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export function analyzeDungeonForBuilder(input: {
  difficulty: Difficulty;
  roomCount: number;
  steps: BuilderStepInput[];
  empirical?: DungeonEmpiricalInput | null;
}): DungeonAnalysisResult {
  const { difficulty, roomCount, steps, empirical = null } = input;
  const issues: DungeonValidationIssue[] = [];
  const slots: SlotAnalysis[] = [];
  const heatmapByStep: number[] = [];

  if (steps.length !== roomCount) {
    issues.push({
      code: "ROOM_COUNT_MISMATCH",
      severity: "ERROR",
      message: `스텝 수(${steps.length})와 방 수(${roomCount})가 일치하지 않습니다.`,
      hint: "설정에서 방 수를 다시 맞추거나 레이아웃을 초기화하세요.",
    });
  }

  const categoryCount = new Map<CardCategory, number>();
  const slotRiskByStep: number[][] = [];
  for (let si = 0; si < steps.length; si++) {
    const step = steps[si];
    const risks: number[] = [];
    for (let bi = 0; bi < step.slots.length; bi++) {
      const card = step.slots[bi];
      if (!card) {
        issues.push({
          code: "EMPTY_SLOT",
          severity: "ERROR",
          message:
            step.kind === "FORK"
              ? `빈 슬롯이 있습니다. (#${si + 1}-${bi + 1})`
              : `빈 슬롯이 있습니다. (#${si + 1})`,
          stepIndex: si,
          slotIndex: bi,
          hint: "카드를 배치하거나 갈림길을 단일로 전환하세요.",
        });
        continue;
      }

      const analysis = makeSlotAnalysis(card, difficulty, si, bi);
      slots.push(analysis);
      risks.push(analysis.risk);
      categoryCount.set(card.category, (categoryCount.get(card.category) ?? 0) + 1);
    }
    slotRiskByStep[si] = risks;
    const avgStepRisk =
      risks.length > 0
        ? Math.round(risks.reduce((acc, n) => acc + n, 0) / risks.length)
        : 0;
    heatmapByStep[si] = avgStepRisk;
  }

  if (slots.length === 0) {
    return {
      slots: [],
      heatmapByStep: heatmapByStep.map(() => 0),
      issues,
      summary: {
        avgRisk: 0,
        peakRisk: 0,
        avgReward: 0,
        avgSustain: 0,
        branchDensity: 0,
        combatDensity: 0,
        trapDensity: 0,
        restDensity: 0,
        estimatedClearRate: CLEAR_RATE_BASE_BY_DIFFICULTY[difficulty],
        calibratedClearRate: CLEAR_RATE_BASE_BY_DIFFICULTY[difficulty],
        empiricalRuns: 0,
        empiricalClearRate: null,
        empiricalCombatWinRate: null,
        estimatedRunMinutesMin: 0,
        estimatedRunMinutesMax: 0,
        calibratedRunMinutesMin: 0,
        calibratedRunMinutesMax: 0,
      },
    };
  }

  const avgRisk = slots.reduce((acc, s) => acc + s.risk, 0) / slots.length;
  const peakRisk = slots.reduce((acc, s) => Math.max(acc, s.risk), 0);
  const avgReward = slots.reduce((acc, s) => acc + s.reward, 0) / slots.length;
  const avgSustain = slots.reduce((acc, s) => acc + s.sustain, 0) / slots.length;
  const branchDensity =
    steps.length > 0
      ? steps.reduce((acc, s) => acc + (s.kind === "FORK" ? 1 : 0), 0) / steps.length
      : 0;
  const combatCount = Array.from(categoryCount.entries()).reduce(
    (acc, [cat, n]) => acc + (COMBAT_CATEGORIES.has(cat) ? n : 0),
    0,
  );
  const trapCount = Array.from(categoryCount.entries()).reduce(
    (acc, [cat, n]) => acc + (TRAP_CATEGORIES.has(cat) ? n : 0),
    0,
  );
  const restCount = Array.from(categoryCount.entries()).reduce(
    (acc, [cat, n]) => acc + (REST_CATEGORIES.has(cat) ? n : 0),
    0,
  );

  const combatDensity = combatCount / Math.max(1, slots.length);
  const trapDensity = trapCount / Math.max(1, slots.length);
  const restDensity = restCount / Math.max(1, slots.length);

  const targetRisk = TARGET_RISK_BY_DIFFICULTY[difficulty];
  const riskDelta = avgRisk - targetRisk;
  const sustainFactor = (avgSustain - 30) / 100;
  const rewardFactor = (avgReward - 45) / 100;
  const peakPenalty = peakRisk >= 90 ? 0.08 : peakRisk >= 82 ? 0.04 : 0;
  let estimatedClearRate =
    CLEAR_RATE_BASE_BY_DIFFICULTY[difficulty] -
    riskDelta * 0.007 +
    sustainFactor * 0.16 +
    rewardFactor * 0.11 -
    peakPenalty;
  estimatedClearRate = clamp(estimatedClearRate, 0.03, 0.95);

  const targetSec = TARGET_STEP_TIME_SEC_BY_DIFFICULTY[difficulty];
  const densityBonusSec =
    combatDensity * 9 + trapDensity * 3 + branchDensity * 2 - restDensity * 2;
  const estimatedRunMinutesCore =
    ((roomCount * (targetSec + densityBonusSec)) / 60) * 1.02;
  const estimatedRunMinutesMin = Math.max(5, Math.round(estimatedRunMinutesCore * 0.82));
  const estimatedRunMinutesMax = Math.max(
    estimatedRunMinutesMin + 2,
    Math.round(estimatedRunMinutesCore * 1.22),
  );

  const empiricalRuns = empirical ? Math.round(finiteNonNegative(empirical.runs)) : 0;
  const empiricalClears = empirical ? Math.round(finiteNonNegative(empirical.clears)) : 0;
  const empiricalFails = empirical ? Math.round(finiteNonNegative(empirical.fails)) : 0;
  const empiricalResolvedRuns = empiricalClears + empiricalFails;
  const empiricalClearRate =
    empiricalResolvedRuns > 0
      ? clamp(empiricalClears / empiricalResolvedRuns, 0, 1)
      : null;
  const empiricalCombatWinRate =
    empirical && finiteNonNegative(empirical.totalCombats) > 0
      ? clamp(
          finiteNonNegative(empirical.totalCombatWins) /
            Math.max(1, finiteNonNegative(empirical.totalCombats)),
          0,
          1,
        )
      : null;
  const empiricalProgressRate =
    empirical && empiricalRuns > 0
      ? clamp(finiteNonNegative(empirical.totalProgressRate) / empiricalRuns, 0, 1)
      : null;
  const empiricalAvgDurationSec =
    empirical && empiricalRuns > 0
      ? finiteNonNegative(empirical.totalDurationSec) / empiricalRuns
      : null;
  const empiricalConfidence = clamp((empiricalRuns - 3) / 27, 0, 1);

  let calibratedClearRate = estimatedClearRate;
  if (empiricalRuns > 0) {
    const completion = empiricalClearRate ?? empiricalProgressRate ?? estimatedClearRate;
    const progress = empiricalProgressRate ?? completion;
    const empiricalComposite = clamp(completion * 0.82 + progress * 0.18, 0, 1);
    const blend = empiricalConfidence * 0.65;
    calibratedClearRate = clamp(
      estimatedClearRate * (1 - blend) + empiricalComposite * blend,
      0.03,
      0.95,
    );
  }

  let calibratedRunMinutesMin = estimatedRunMinutesMin;
  let calibratedRunMinutesMax = estimatedRunMinutesMax;
  if (empiricalAvgDurationSec !== null && empiricalAvgDurationSec > 0) {
    const observedMin = Math.max(5, Math.round((empiricalAvgDurationSec / 60) * 0.84));
    const observedMax = Math.max(observedMin + 2, Math.round((empiricalAvgDurationSec / 60) * 1.18));
    const timeBlend = empiricalConfidence * 0.7;
    calibratedRunMinutesMin = Math.max(
      5,
      Math.round(estimatedRunMinutesMin * (1 - timeBlend) + observedMin * timeBlend),
    );
    calibratedRunMinutesMax = Math.max(
      calibratedRunMinutesMin + 2,
      Math.round(estimatedRunMinutesMax * (1 - timeBlend) + observedMax * timeBlend),
    );
  }

  // Rhythm checks.
  const introEnd = Math.min(3, heatmapByStep.length);
  const introAvg =
    introEnd > 0
      ? heatmapByStep.slice(0, introEnd).reduce((acc, n) => acc + n, 0) / introEnd
      : 0;
  if (introAvg >= targetRisk + 12) {
    issues.push({
      code: "INTRO_TOO_HARD",
      severity: "WARN",
      message: "초반 1~3스텝 난이도가 높습니다.",
      hint: "초반에 휴식/이벤트/NPC를 한두 개 배치해 학습 구간을 확보하세요.",
    });
  }

  const hasBossLate = slots.some((s) => {
    if (s.category !== "CARD_BOSS") return false;
    const ratio = (s.stepIndex + 1) / Math.max(1, steps.length);
    return ratio >= 0.65;
  });
  if (!hasBossLate) {
    issues.push({
      code: "NO_LATE_BOSS",
      severity: "WARN",
      message: "후반부 보스 압박 구간이 부족합니다.",
      hint: "전체 65% 이후 스텝에 보스를 배치하면 완성도가 올라갑니다.",
    });
  }

  if (restDensity <= 0.06) {
    issues.push({
      code: "LOW_RECOVERY",
      severity: "WARN",
      message: "회복 구간이 부족해 런이 급격히 붕괴될 수 있습니다.",
      hint: "REST 카드 또는 완화형 이벤트를 소량 추가하세요.",
    });
  }

  if (trapDensity >= 0.28) {
    issues.push({
      code: "TRAP_DENSE",
      severity: "WARN",
      message: "함정 비중이 높아 피로도가 크게 증가할 수 있습니다.",
      hint: "함정을 이벤트/전투/보상 카드로 분산하세요.",
    });
  }

  if (avgRisk >= targetRisk + 20 && peakRisk >= 92) {
    issues.push({
      code: "RISK_OVERSHOOT",
      severity: "ERROR",
      message: "현재 레이아웃은 난이도 대비 과도하게 위험합니다.",
      hint: "고위험 카드를 줄이거나 중반 회복 구간을 추가하세요.",
    });
  }

  if (avgRisk <= targetRisk - 16 && difficulty !== "EASY") {
    issues.push({
      code: "RISK_UNDERSHOOT",
      severity: "INFO",
      message: "난이도 대비 긴장감이 낮습니다.",
      hint: "중후반 전투/함정 밀도를 소폭 올리면 완주 만족도가 좋아집니다.",
    });
  }

  if (empiricalRuns >= 10 && empiricalClearRate !== null) {
    if (Math.abs(empiricalClearRate - estimatedClearRate) >= 0.18) {
      issues.push({
        code: "MODEL_DRIFT",
        severity: "WARN",
        message: "실측 완주율과 예측 완주율의 차이가 큽니다.",
        hint: "전투/함정 밀도를 조정하거나 실측 런을 더 수집해 보정 정확도를 높이세요.",
      });
    }

    if (difficulty !== "NIGHTMARE" && empiricalClearRate <= 0.14) {
      issues.push({
        code: "EMPIRICAL_TOO_HARD",
        severity: "ERROR",
        message: "실측 기준 난이도가 과도합니다. (완주율 14% 이하)",
        hint: "중반 회복/완화 구간을 추가하고 함정 연속 구간을 줄이세요.",
      });
    }

    if (difficulty !== "EASY" && empiricalClearRate >= 0.88) {
      issues.push({
        code: "EMPIRICAL_TOO_EASY",
        severity: "WARN",
        message: "실측 기준 긴장감이 낮습니다. (완주율 88% 이상)",
        hint: "중후반에 전투 압박 또는 선택 리스크를 소폭 강화하세요.",
      });
    }
  }

  if (empiricalRuns >= 10 && empiricalCombatWinRate !== null && empiricalCombatWinRate < 0.36) {
    issues.push({
      code: "LOW_COMBAT_WINRATE",
      severity: "WARN",
      message: "실측 전투 승률이 낮아 체감 피로도가 높습니다.",
      hint: "핵심 전투 카드의 ATK/효과 태그를 완화하거나 보상 밀도를 보강하세요.",
    });
  }

  // Long drought check: 6-step window without recovery/reward cards.
  const supportiveCats = new Set<CardCategory>([
    "CARD_REST_CAMPFIRE",
    "CARD_REST_SMITHY",
    "CARD_REST_STATUE",
    "CARD_LOOT_CHEST",
    "CARD_NPC_TRADER",
    "CARD_NPC_TALK",
    "CARD_SHRINE",
    "CARD_EVENT_CHOICE",
  ]);
  for (let i = 0; i + 5 < steps.length; i++) {
    let foundSupport = false;
    for (let j = i; j < i + 6; j++) {
      const step = steps[j];
      if (!step) continue;
      for (const slot of step.slots) {
        if (slot && supportiveCats.has(slot.category)) foundSupport = true;
      }
    }
    if (!foundSupport) {
      issues.push({
        code: "LONG_DROUGHT",
        severity: "WARN",
        message: `${i + 1}~${i + 6} 스텝에 완화/보상 구간이 거의 없습니다.`,
        hint: "보상 또는 회복 카드를 한두 개 추가해 리듬을 완화하세요.",
        stepIndex: i,
      });
      break;
    }
  }

  const errorCount = countSeverity(issues, "ERROR");
  const warnCount = countSeverity(issues, "WARN");
  if (errorCount === 0 && warnCount === 0) {
    issues.push({
      code: "GOOD_LAYOUT",
      severity: "INFO",
      message: "현재 레이아웃은 구조적으로 안정적입니다.",
      hint: "세부 텍스트와 보상 연출만 다듬으면 게시 품질이 높습니다.",
    });
  }

  return {
    slots,
    heatmapByStep,
    issues,
    summary: {
      avgRisk: Math.round(avgRisk),
      peakRisk: Math.round(peakRisk),
      avgReward: Math.round(avgReward),
      avgSustain: Math.round(avgSustain),
      branchDensity: Math.round(branchDensity * 100) / 100,
      combatDensity: Math.round(combatDensity * 100) / 100,
      trapDensity: Math.round(trapDensity * 100) / 100,
      restDensity: Math.round(restDensity * 100) / 100,
      estimatedClearRate: Math.round(estimatedClearRate * 1000) / 1000,
      calibratedClearRate: Math.round(calibratedClearRate * 1000) / 1000,
      empiricalRuns,
      empiricalClearRate:
        empiricalClearRate === null
          ? null
          : Math.round(empiricalClearRate * 1000) / 1000,
      empiricalCombatWinRate:
        empiricalCombatWinRate === null
          ? null
          : Math.round(empiricalCombatWinRate * 1000) / 1000,
      estimatedRunMinutesMin,
      estimatedRunMinutesMax,
      calibratedRunMinutesMin,
      calibratedRunMinutesMax,
    },
  };
}
