import type { PrimaryCategory } from "@/types/builder";
import type { CardCategory } from "@/types/card";

export function mapBuilderSelectionToCardCategory(
  primary: PrimaryCategory,
  sub: string | null,
): CardCategory {
  switch (primary) {
    case "MONSTER":
      if (sub === "SINGLE") return "CARD_ENEMY_SINGLE";
      if (sub === "SQUAD") return "CARD_ENEMY_SQUAD";
      throw new Error("몬스터는 '단일/군단' 세부 유형이 필요합니다.");
    case "BOSS":
      return "CARD_BOSS";
    case "TRAP":
      if (sub === "INSTANT") return "CARD_TRAP_INSTANT";
      if (sub === "ROOM") return "CARD_TRAP_ROOM";
      throw new Error("함정은 '즉발/환경' 세부 유형이 필요합니다.");
    case "SHRINE":
      return "CARD_SHRINE";
    case "TREASURE":
      return "CARD_LOOT_CHEST";
    case "NPC":
      if (sub === "TRADER") return "CARD_NPC_TRADER";
      if (sub === "QUEST") return "CARD_NPC_QUEST";
      if (sub === "TALK") return "CARD_NPC_TALK";
      throw new Error("NPC는 '상인/의뢰/대화' 세부 유형이 필요합니다.");
    case "REST":
      if (sub === "CAMPFIRE") return "CARD_REST_CAMPFIRE";
      if (sub === "SMITHY") return "CARD_REST_SMITHY";
      if (sub === "STATUE") return "CARD_REST_STATUE";
      throw new Error("휴식은 '모닥불/대장간/여신상' 세부 유형이 필요합니다.");
  }
}

