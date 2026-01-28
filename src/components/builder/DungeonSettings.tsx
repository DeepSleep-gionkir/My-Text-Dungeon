"use client";

import { useState } from "react";
import { FaCog } from "react-icons/fa";
import type { Difficulty } from "@/types/builder";

interface DungeonSettingsProps {
  roomCount: number;
  difficulty: Difficulty;
  onRoomCountChange: (count: number) => void;
  onDifficultyChange: (diff: Difficulty) => void;
}

const difficultyInfo: Record<
  Difficulty,
  { label: string; color: string; desc: string }
> = {
  EASY: {
    label: "쉬움",
    color: "text-green-400 border-green-600",
    desc: "스탯 0.8배, 보상 0.8배",
  },
  NORMAL: {
    label: "보통",
    color: "text-blue-400 border-blue-600",
    desc: "표준 밸런스",
  },
  HARD: {
    label: "어려움",
    color: "text-orange-400 border-orange-600",
    desc: "스탯 1.3배, 보상 1.5배",
  },
  NIGHTMARE: {
    label: "악몽",
    color: "text-red-500 border-red-600",
    desc: "스탯 1.8배, 보상 2.5배",
  },
};

export default function DungeonSettings({
  roomCount,
  difficulty,
  onRoomCountChange,
  onDifficultyChange,
}: DungeonSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
      >
        <FaCog className={isOpen ? "animate-spin" : ""} />
        <span className="text-sm">설정</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-72 bg-surface border border-gray-800 rounded-lg p-4 shadow-xl z-50">
          <h4 className="text-sm font-bold text-gray-200 mb-4">던전 설정</h4>

          {/* Room Count */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 block mb-2">방 개수</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={50}
                step={5}
                value={roomCount}
                onChange={(e) => onRoomCountChange(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm text-gray-300 w-8 text-right">
                {roomCount}
              </span>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-xs text-gray-500 block mb-2">난이도</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(difficultyInfo) as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => onDifficultyChange(diff)}
                  className={`py-2 px-3 rounded border text-xs transition-colors ${
                    difficulty === diff
                      ? `bg-black/50 ${difficultyInfo[diff].color}`
                      : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {difficultyInfo[diff].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2 italic">
              {difficultyInfo[difficulty].desc}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
