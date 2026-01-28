import type { Difficulty } from "@/types/builder";
import type {
  CardAction,
  CardCategory,
  CardData,
  CardGrade,
  CardReward,
  CardStats,
  CheckInfo,
  DialogueData,
  MimicData,
  QuestData,
  ShrineOption,
  TradeItem,
} from "@/types/card";

const CARD_GRADES: readonly CardGrade[] = [
  "NORMAL",
  "ELITE",
  "BOSS",
  "EPIC",
  "LEGENDARY",
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const asString = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

const asNumber = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const defaultDCByDifficulty: Record<Difficulty, number> = {
  EASY: 11,
  NORMAL: 15,
  HARD: 18,
  NIGHTMARE: 22,
};

const baseStatsByDifficulty: Record<Difficulty, CardStats> = {
  EASY: { hp: 70, atk: 8, def: 2, spd: 10 },
  NORMAL: { hp: 95, atk: 12, def: 4, spd: 11 },
  HARD: { hp: 130, atk: 18, def: 6, spd: 12 },
  NIGHTMARE: { hp: 180, atk: 26, def: 8, spd: 13 },
};

const shrinePresetByDifficulty: Record<
  Difficulty,
  {
    atkUp: number;
    defUp: number;
    spdUp: number;
    maxHpPctUp: number;
    goldGain: number;
    hpCost: number;
    goldCost: number;
    mpCost: number;
    maxHpPctDown: number;
    defDown: number;
  }
> = {
  EASY: {
    atkUp: 2,
    defUp: 2,
    spdUp: 3,
    maxHpPctUp: 8,
    goldGain: 120,
    hpCost: 12,
    goldCost: 60,
    mpCost: 10,
    maxHpPctDown: 5,
    defDown: 2,
  },
  NORMAL: {
    atkUp: 3,
    defUp: 3,
    spdUp: 4,
    maxHpPctUp: 10,
    goldGain: 200,
    hpCost: 18,
    goldCost: 120,
    mpCost: 18,
    maxHpPctDown: 8,
    defDown: 3,
  },
  HARD: {
    atkUp: 4,
    defUp: 4,
    spdUp: 5,
    maxHpPctUp: 12,
    goldGain: 320,
    hpCost: 26,
    goldCost: 200,
    mpCost: 28,
    maxHpPctDown: 10,
    defDown: 4,
  },
  NIGHTMARE: {
    atkUp: 6,
    defUp: 6,
    spdUp: 7,
    maxHpPctUp: 15,
    goldGain: 520,
    hpCost: 40,
    goldCost: 320,
    mpCost: 45,
    maxHpPctDown: 12,
    defDown: 5,
  },
};

const traderPresetByDifficulty: Record<Difficulty, TradeItem[]> = {
  EASY: [
    { id: "ITEM_POTION_S", price: 60 },
    { id: "ITEM_SMOKE_BOMB", price: 90 },
    { id: "ITEM_SHARPENING_STONE", price: 110 },
    { id: "ITEM_ARMOR_PATCH", price: 110 },
  ],
  NORMAL: [
    { id: "ITEM_POTION_S", price: 80 },
    { id: "ITEM_SMOKE_BOMB", price: 120 },
    { id: "ITEM_SHARPENING_STONE", price: 150 },
    { id: "ITEM_ARMOR_PATCH", price: 150 },
  ],
  HARD: [
    { id: "ITEM_POTION_S", price: 110 },
    { id: "ITEM_SMOKE_BOMB", price: 170 },
    { id: "ITEM_SHARPENING_STONE", price: 210 },
    { id: "ITEM_ARMOR_PATCH", price: 210 },
  ],
  NIGHTMARE: [
    { id: "ITEM_POTION_S", price: 140 },
    { id: "ITEM_SMOKE_BOMB", price: 220 },
    { id: "ITEM_SHARPENING_STONE", price: 280 },
    { id: "ITEM_ARMOR_PATCH", price: 280 },
  ],
};

function buildDefaultShrineOptions(difficulty: Difficulty): ShrineOption[] {
  const p = shrinePresetByDifficulty[difficulty];
  return [
    {
      id: "OPT_01",
      cost_type: "HP_FLAT",
      cost_value: p.hpCost,
      reward_type: "STAT_ATK_UP",
      reward_value: p.atkUp,
      text: `[피의 의식] HP ${p.hpCost}를 바치고 공격력 +${p.atkUp}`,
    },
    {
      id: "OPT_02",
      cost_type: "GOLD_FLAT",
      cost_value: p.goldCost,
      reward_type: "HEAL_FULL",
      reward_value: 1,
      text: `[헌금] ${p.goldCost}G를 바치고 완전 회복`,
    },
    {
      id: "OPT_03",
      cost_type: "MAXHP_PCT_DOWN",
      cost_value: p.maxHpPctDown,
      reward_type: "STAT_DEF_UP",
      reward_value: p.defUp,
      text: `[각인] 최대 HP -${p.maxHpPctDown}% 대신 방어력 +${p.defUp}`,
    },
    {
      id: "OPT_04",
      cost_type: "MP_FLAT",
      cost_value: p.mpCost,
      reward_type: "STAT_SPD_UP",
      reward_value: p.spdUp,
      text: `[정신의 거래] MP ${p.mpCost} 소모, 속도 +${p.spdUp}`,
    },
    {
      id: "OPT_05",
      cost_type: "DEF_DOWN",
      cost_value: p.defDown,
      reward_type: "GAIN_GOLD",
      reward_value: p.goldGain,
      text: `[탐욕] 방어력 -${p.defDown} 대신 ${p.goldGain}G 획득`,
    },
  ];
}

function pickDefaultStats(
  category: CardCategory,
  grade: CardGrade,
  difficulty: Difficulty,
): CardStats {
  const base = baseStatsByDifficulty[difficulty];
  let hpMul = 1;
  let atkMul = 1;
  let defMul = 1;
  const spdMul = 1;

  if (category === "CARD_ENEMY_SQUAD") {
    hpMul *= 1.6;
    atkMul *= 0.9;
  }
  if (category === "CARD_BOSS") {
    hpMul *= 4.0;
    atkMul *= 1.4;
    defMul *= 1.2;
  }

  if (grade === "ELITE") {
    hpMul *= 1.6;
    atkMul *= 1.3;
    defMul *= 1.2;
  }
  if (grade === "EPIC") {
    hpMul *= 1.9;
    atkMul *= 1.45;
    defMul *= 1.25;
  }
  if (grade === "LEGENDARY") {
    hpMul *= 2.3;
    atkMul *= 1.6;
    defMul *= 1.35;
  }

  return {
    hp: Math.round(base.hp * hpMul),
    atk: Math.round(base.atk * atkMul),
    def: Math.round(base.def * defMul),
    spd: Math.round(base.spd * spdMul),
  };
}

function normalizeStats(v: unknown): CardStats | null {
  if (!isRecord(v)) return null;
  const hp = asNumber(v.hp);
  const atk = asNumber(v.atk);
  const def = asNumber(v.def);
  const spd = asNumber(v.spd);
  if (hp === null || atk === null || def === null || spd === null) return null;
  return {
    hp: Math.round(clamp(hp, 1, 99999)),
    atk: Math.round(clamp(atk, 0, 9999)),
    def: Math.round(clamp(def, 0, 9999)),
    spd: Math.round(clamp(spd, 0, 999)),
  };
}

function normalizeTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const tags = v
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 12);
}

function normalizeActions(v: unknown): CardAction[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: CardAction[] = [];
  for (const raw of v) {
    if (!isRecord(raw)) continue;

    const msg = asString(raw.msg) ?? asString(raw.text);
    const type = asString(raw.type);
    if (!msg || !type) continue;

    const triggerRaw = asString(raw.trigger) ?? "PASSIVE";
    const trigger = triggerRaw as CardAction["trigger"];
    const value = asNumber(raw.value);
    const count = asNumber(raw.count);
    const chance = asNumber(raw.chance);
    const effect = asString(raw.effect);

    out.push({
      trigger,
      type,
      msg,
      value: value ?? undefined,
      effect: effect ?? undefined,
      count: count ?? undefined,
      chance: chance ?? undefined,
    });
  }
  return out.length ? out : undefined;
}

function normalizeCheckInfo(v: unknown, difficulty: Difficulty): CheckInfo | null {
  if (!isRecord(v)) return null;
  const stat = asString(v.stat);
  const dc = asNumber(v.difficulty);
  if (!stat) return null;
  const normalized = stat.toUpperCase() as CheckInfo["stat"];
  const allowed: CheckInfo["stat"][] = ["STR", "DEX", "INT", "LUK", "AGI"];
  if (!allowed.includes(normalized)) return null;
  return {
    stat: normalized,
    difficulty: Math.round(clamp(dc ?? defaultDCByDifficulty[difficulty], 5, 30)),
  };
}

function normalizeRewards(v: unknown): CardReward | undefined {
  if (!isRecord(v)) return undefined;
  const out: CardReward = {};

  const gold = v.gold;
  if (typeof gold === "number" && Number.isFinite(gold)) out.gold = gold;
  if (isRecord(gold)) {
    const min = asNumber(gold.min);
    const max = asNumber(gold.max);
    if (min !== null && max !== null) out.gold = { min, max };
  }

  const items = v.items;
  if (Array.isArray(items)) out.items = items as CardReward["items"];

  const xp = asNumber(v.xp);
  if (xp !== null) out.xp = xp;

  return Object.keys(out).length ? out : undefined;
}

function normalizeShrineOptions(v: unknown): ShrineOption[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: ShrineOption[] = [];
  for (const raw of v) {
    if (!isRecord(raw)) continue;
    const id = asString(raw.id);
    const cost_type = asString(raw.cost_type);
    const reward_type = asString(raw.reward_type);
    const text = asString(raw.text);
    if (!id || !cost_type || !reward_type || !text) continue;
    const cost_value = raw.cost_value;
    const reward_value = raw.reward_value;
    const costOk =
      (typeof cost_value === "number" && Number.isFinite(cost_value)) ||
      typeof cost_value === "string";
    const rewardOk =
      (typeof reward_value === "number" && Number.isFinite(reward_value)) ||
      typeof reward_value === "string";
    if (!costOk || !rewardOk) continue;
    out.push({
      id,
      cost_type,
      cost_value: cost_value as ShrineOption["cost_value"],
      reward_type,
      reward_value: reward_value as ShrineOption["reward_value"],
      text,
    });
  }
  return out.length ? out : undefined;
}

function ensureShrineOptions(
  options: ShrineOption[] | undefined,
  difficulty: Difficulty,
): ShrineOption[] {
  const base = buildDefaultShrineOptions(difficulty);
  const fromAI = (options ?? []).slice(0, 5);
  if (fromAI.length === 5) return fromAI;

  const usedIds = new Set(fromAI.map((o) => o.id));
  const fill = base.filter((o) => !usedIds.has(o.id));
  return [...fromAI, ...fill].slice(0, 5);
}

function normalizeTradeList(v: unknown): TradeItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: TradeItem[] = [];
  for (const raw of v) {
    if (!isRecord(raw)) continue;
    const id = asString(raw.id);
    const price = asNumber(raw.price);
    if (!id || price === null) continue;
    out.push({ id, price: Math.round(clamp(price, 0, 999999)) });
  }
  return out.length ? out : undefined;
}

function ensureTradeList(
  list: TradeItem[] | undefined,
  difficulty: Difficulty,
): TradeItem[] {
  const base = traderPresetByDifficulty[difficulty];
  const fromAI = (list ?? []).slice(0, 6);
  if (fromAI.length >= 3) return fromAI;

  const usedIds = new Set(fromAI.map((it) => it.id));
  const fill = base.filter((it) => !usedIds.has(it.id));
  return [...fromAI, ...fill].slice(0, 6);
}

function normalizeDialogue(v: unknown): DialogueData | undefined {
  if (!isRecord(v)) return undefined;
  const start = asString(v.start);
  if (!start) return undefined;
  const accept = asString(v.accept) ?? undefined;
  const reject = asString(v.reject) ?? undefined;
  return { start, accept, reject };
}

function normalizeQuest(v: unknown): QuestData | undefined {
  if (!isRecord(v)) return undefined;
  const target = asString(v.target);
  const reward = asString(v.reward);
  if (!target || !reward) return undefined;
  const allowed: QuestData["target"][] = [
    "KILL_MONSTER",
    "OPEN_CHEST",
    "REACH_ROOM",
    "SURVIVE_TURNS",
  ];
  const normalizedTarget = target.toUpperCase() as QuestData["target"];
  if (!allowed.includes(normalizedTarget)) return undefined;
  const target_tag = asString(v.target_tag) ?? undefined;
  const count = asNumber(v.count) ?? undefined;
  return {
    target: normalizedTarget,
    target_tag,
    count: count !== undefined ? Math.round(clamp(count, 1, 999)) : undefined,
    reward,
  };
}

function normalizeMimic(v: unknown): MimicData | null | undefined {
  if (v === null) return null;
  if (!isRecord(v)) return undefined;
  const isMimic = v.isMimic === true;
  const stats = normalizeStats(v.stats);
  return { isMimic, stats: stats ?? undefined };
}

export function normalizeCardData(
  raw: unknown,
  forcedCategory: CardCategory,
  difficulty: Difficulty,
): CardData {
  if (!isRecord(raw)) throw new Error("카드 JSON이 객체가 아닙니다.");

  const name = (asString(raw.name) ?? "").trim();
  const description = (asString(raw.description) ?? "").trim();
  if (!name) throw new Error("name이 비어있습니다.");
  if (!description) throw new Error("description이 비어있습니다.");

  const gradeRaw = asString(raw.grade);
  const gradeFromAI = gradeRaw && (CARD_GRADES as readonly string[]).includes(gradeRaw)
    ? (gradeRaw as CardGrade)
    : undefined;

  const grade: CardGrade =
    forcedCategory === "CARD_BOSS" ? "BOSS" : gradeFromAI ?? "NORMAL";

  const tags = normalizeTags(raw.tags);
  const statsFromAI = normalizeStats(raw.stats);
  const actions = normalizeActions(raw.actions);
  const check_info = normalizeCheckInfo(raw.check_info, difficulty);
  const rewards = normalizeRewards(raw.rewards);
  const options = normalizeShrineOptions(raw.options);
  const trade_list = normalizeTradeList(raw.trade_list);
  const dialogue = normalizeDialogue(raw.dialogue);
  const quest = normalizeQuest(raw.quest);
  const mimic_data = normalizeMimic(raw.mimic_data);
  const hp = asNumber(raw.hp) ?? undefined;
  const loot_on_death = Array.isArray(raw.loot_on_death)
    ? raw.loot_on_death.filter((x): x is string => typeof x === "string")
    : undefined;

  const needsStats =
    forcedCategory === "CARD_ENEMY_SINGLE" ||
    forcedCategory === "CARD_ENEMY_SQUAD" ||
    forcedCategory === "CARD_BOSS";

  const needsCheck =
    forcedCategory === "CARD_TRAP_INSTANT" || forcedCategory === "CARD_TRAP_ROOM";

  const normalizedStats =
    needsStats && !statsFromAI ? pickDefaultStats(forcedCategory, grade, difficulty) : statsFromAI ?? undefined;

  const fallbackCheck: CheckInfo = {
    stat: "DEX",
    difficulty: defaultDCByDifficulty[difficulty],
  };
  const normalizedCheck = needsCheck ? (check_info ?? fallbackCheck) : undefined;

  const normalizedActions =
    needsStats && (!actions || actions.length === 0)
      ? ([
          {
            trigger: "ON_TURN",
            type: "LOGIC_ATTACK",
            value: 1.0,
            msg: "적이 공격해옵니다.",
          },
        ] as CardAction[])
      : actions;

  return {
    category: forcedCategory,
    name,
    description,
    grade,
    tags,
    stats: normalizedStats,
    check_info: normalizedCheck,
    actions: normalizedActions,
    rewards,
    options: forcedCategory === "CARD_SHRINE" ? ensureShrineOptions(options, difficulty) : options,
    mimic_data,
    trade_list:
      forcedCategory === "CARD_NPC_TRADER"
        ? ensureTradeList(trade_list, difficulty)
        : trade_list,
    dialogue,
    quest,
    hp: hp !== undefined ? Math.round(clamp(hp, 1, 99999)) : undefined,
    loot_on_death,
  };
}
