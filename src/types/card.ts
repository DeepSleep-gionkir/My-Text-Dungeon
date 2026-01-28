export type CardCategory =
  | "CARD_ENEMY_SINGLE"
  | "CARD_ENEMY_SQUAD"
  | "CARD_BOSS"
  | "CARD_TRAP_INSTANT"
  | "CARD_TRAP_ROOM"
  | "CARD_LOOT_CHEST"
  | "CARD_SHRINE"
  | "CARD_EVENT_CHOICE"
  | "CARD_NPC_TRADER"
  | "CARD_NPC_QUEST"
  | "CARD_NPC_TALK"
  | "CARD_REST_CAMPFIRE"
  | "CARD_REST_SMITHY"
  | "CARD_REST_STATUE";

export type CardGrade = "NORMAL" | "ELITE" | "BOSS" | "EPIC" | "LEGENDARY";

export interface CardAction {
  trigger:
    | "ON_TURN"
    | "ON_HIT"
    | "HP_BELOW_50"
    | "PASSIVE"
    | "ON_DISARM_SUCCESS"
    | "ON_TURN_START"
    | "ON_ALLY_DEATH";
  type: string;
  value?: number;
  msg: string;
  effect?: string;
  count?: number;
  chance?: number;
}

export interface CardReward {
  gold?: number | { min: number; max: number };
  items?: string[] | { id: string; rate: number; name: string }[];
  xp?: number;
}

export interface CardStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface CheckInfo {
  stat: "STR" | "DEX" | "INT" | "LUK" | "AGI";
  difficulty: number;
}

export interface ShrineOption {
  id: string;
  cost_type: string;
  cost_value: number | string;
  reward_type: string;
  reward_value: number | string;
  text: string;
}

export interface TradeItem {
  id: string;
  price: number;
}

export interface DialogueData {
  start: string;
  accept?: string;
  reject?: string;
}

export interface QuestData {
  target: "KILL_MONSTER" | "OPEN_CHEST" | "REACH_ROOM" | "SURVIVE_TURNS";
  target_tag?: string;
  count?: number;
  reward: string;
}

export interface MimicData {
  isMimic: boolean;
  stats?: CardStats;
}

export interface CardData {
  category: CardCategory;
  name: string;
  description: string;
  grade: CardGrade;

  tags: string[];

  // Monster Stats
  stats?: CardStats;

  // Trap/Event Check
  check_info?: CheckInfo;

  // Actions/Logic
  actions?: CardAction[];

  // Rewards
  rewards?: CardReward;

  // Shrine specific
  options?: ShrineOption[];

  // Treasure specific
  mimic_data?: MimicData | null;

  // NPC specific
  trade_list?: TradeItem[];
  dialogue?: DialogueData;
  quest?: QuestData;
  hp?: number;
  loot_on_death?: string[];
}
