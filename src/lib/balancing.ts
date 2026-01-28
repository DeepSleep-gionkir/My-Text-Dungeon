import type { Difficulty } from "@/types/builder";

export const ROOM_COUNT_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 15,
  NORMAL: 25,
  HARD: 40,
  NIGHTMARE: 50,
};

