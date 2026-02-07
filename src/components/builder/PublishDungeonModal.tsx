"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FaCheck, FaCog, FaScroll, FaTimes } from "react-icons/fa";
import type { Difficulty } from "@/types/builder";

export default function PublishDungeonModal({
  open,
  onClose,
  roomCount,
  slotCount,
  difficulty,
  onPublish,
  onEdit,
  isPublishing,
  error,
  name,
  description,
  mode = "publish",
}: {
  open: boolean;
  onClose: () => void;
  roomCount: number;
  slotCount?: number;
  difficulty: Difficulty;
  onPublish: () => void;
  onEdit?: () => void;
  isPublishing: boolean;
  error: string | null;
  name: string;
  description: string;
  mode?: "publish" | "update";
}) {
  const canSubmit = name.trim().length >= 2 && !isPublishing;
  const title = mode === "update" ? "던전 수정" : "던전 게시";
  const submitLabel = mode === "update" ? "저장하기" : "게시하기";
  const submittingLabel = mode === "update" ? "저장 중..." : "게시 중...";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="w-full max-w-xl bg-surface border border-gray-800 rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-200 font-serif font-bold">
                <FaScroll className="text-primary" />
                <span>{title}</span>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors"
                aria-label="닫기"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-500">
                진행 방 {roomCount}개
                {typeof slotCount === "number" && slotCount !== roomCount
                  ? ` / 슬롯 ${slotCount}개`
                  : ""}{" "}
                / 난이도{" "}
                <span className="text-gray-300">{difficulty}</span>
              </div>

              <div className="border border-gray-800 bg-black/30 rounded p-4">
                <div className="text-gray-200 font-bold">{name}</div>
                <div className="mt-2 text-sm text-gray-500 whitespace-pre-wrap">
                  {description.trim()
                    ? description.trim()
                    : "소개가 없습니다."}
                </div>
              </div>

              {onEdit && (
                <button
                  onClick={() => {
                    onClose();
                    onEdit();
                  }}
                  className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <FaCog />
                  설정 변경
                </button>
              )}

              {error && (
                <div className="text-sm rounded border border-red-900 bg-red-900/10 text-red-300 px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-800 flex flex-col sm:flex-row gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-900 border border-gray-700 rounded text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
              >
                취소
              </button>
              <button
                onClick={onPublish}
                disabled={!canSubmit}
                className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors disabled:opacity-60"
              >
                <FaCheck />
                {isPublishing ? submittingLabel : submitLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
