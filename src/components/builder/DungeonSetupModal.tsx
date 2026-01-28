"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaCheck, FaChevronLeft, FaCog, FaTimes } from "react-icons/fa";
import type { Difficulty } from "@/types/builder";
import { ROOM_COUNT_BY_DIFFICULTY } from "@/lib/balancing";

export type DungeonSetup = {
  name: string;
  description: string;
  roomCount: number;
  difficulty: Difficulty;
};

const difficultyInfo: Record<
  Difficulty,
  { label: string; desc: string; border: string }
> = {
  EASY: { label: "쉬움", desc: "스탯 0.8배, 보상 0.8배", border: "border-green-700 text-green-300" },
  NORMAL: { label: "보통", desc: "표준 밸런스", border: "border-gray-700 text-gray-200" },
  HARD: { label: "어려움", desc: "스탯 1.3배, 보상 1.5배", border: "border-orange-700 text-orange-300" },
  NIGHTMARE: { label: "악몽", desc: "스탯 1.8배, 보상 2.5배", border: "border-red-900 text-red-300" },
};

export default function DungeonSetupModal({
  open,
  initial,
  mode,
  onExit,
  onConfirm,
}: {
  open: boolean;
  initial: DungeonSetup;
  mode: "start" | "edit";
  onExit: () => void;
  onConfirm: (next: DungeonSetup) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
  const roomCount = ROOM_COUNT_BY_DIFFICULTY[difficulty];

  useEffect(() => {
    if (!open) return;
    setName(initial.name);
    setDescription(initial.description);
    setDifficulty(initial.difficulty);
  }, [open, initial]);

  const canConfirm = name.trim().length >= 2;
  const subtitle = useMemo(() => {
    if (mode === "start") return "빌드를 시작하기 전에 던전의 기본 정보를 설정하세요.";
    return "설정을 변경하면 현재 레이아웃이 초기화될 수 있습니다.";
  }, [mode]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            className="w-full max-w-2xl bg-surface border border-gray-800 rounded-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-200 font-serif font-bold">
                <FaCog className="text-primary" />
                <span>{mode === "start" ? "던전 설정" : "설정 변경"}</span>
              </div>
              {mode === "edit" && (
                <button
                  onClick={onExit}
                  className="text-gray-500 hover:text-white transition-colors"
                  aria-label="닫기"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            <div className="p-5 space-y-5">
              <div className="text-sm text-gray-500">{subtitle}</div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                    던전 이름
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 검은 서리의 회랑"
                    className="w-full bg-gray-900 border border-gray-700 rounded-md py-3 px-3 text-gray-200 focus:outline-none focus:border-primary transition-colors"
                    autoFocus
                  />
                  <div className="text-xs text-gray-600">
                    이름은 2글자 이상이어야 합니다.
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                    거쳐야 할 방 수
                  </label>
                  <div className="bg-gray-900 border border-gray-700 rounded-md py-3 px-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-200 font-bold">
                        {roomCount} 방
                      </div>
                      <div className="text-xs text-gray-600">
                        난이도에 따라 자동 설정
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      쉬움 15 / 보통 25 / 어려움 40 / 악몽 50
                    </div>
                    <div className="mt-1 text-xs text-gray-700">
                      갈림길을 만들면 선택지 방 슬롯이 1개씩 추가됩니다.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                  소개 (선택)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 얼어붙은 폐허를 지나 최심부의 보스를 처치하세요."
                  className="w-full bg-gray-900 border border-gray-700 rounded-md py-3 px-3 text-gray-200 focus:outline-none focus:border-primary transition-colors min-h-[110px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                  난이도
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(Object.keys(difficultyInfo) as Difficulty[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setDifficulty(diff)}
                      className={`rounded border px-3 py-2 text-xs transition-colors ${
                        difficulty === diff
                          ? `bg-black/40 ${difficultyInfo[diff].border} border-primary/40`
                          : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {difficultyInfo[diff].label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-gray-600 italic">
                  {difficultyInfo[difficulty].desc}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-800 flex flex-col sm:flex-row gap-2">
              {mode === "start" ? (
                <button
                  onClick={onExit}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  <FaChevronLeft />
                  로비로
                </button>
              ) : (
                <button
                  onClick={onExit}
                  className="px-4 py-2 bg-gray-900 border border-gray-700 rounded text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  취소
                </button>
              )}

              <button
                onClick={() =>
                  onConfirm({
                    name: name.trim(),
                    description: description.trim(),
                    roomCount: ROOM_COUNT_BY_DIFFICULTY[difficulty],
                    difficulty,
                  })
                }
                disabled={!canConfirm}
                className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors disabled:opacity-60"
              >
                <FaCheck />
                {mode === "start" ? "시작하기" : "적용"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
