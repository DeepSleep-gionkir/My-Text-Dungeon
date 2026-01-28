"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaCheck, FaKey, FaTimes, FaTrash, FaVial } from "react-icons/fa";
import { generateGeminiContent } from "@/lib/gemini";
import { useUserStore } from "@/store/useUserStore";

export default function GeminiKeyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const geminiApiKey = useUserStore((s) => s.geminiApiKey);
  const setGeminiApiKey = useUserStore((s) => s.setGeminiApiKey);

  const masked = useMemo(() => {
    if (!geminiApiKey) return null;
    const tail = geminiApiKey.slice(-4);
    return `************${tail}`;
  }, [geminiApiKey]);

  const [input, setInput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { ok: true; msg: string }
    | { ok: false; msg: string }
    | null
  >(null);

  const keyToUse = input.trim() || geminiApiKey || "";

  const handleTest = async () => {
    if (!keyToUse) {
      setTestResult({ ok: false, msg: "API 키를 입력하세요." });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      await generateGeminiContent(keyToUse, "한 단어로만 답하세요: OK");
      setTestResult({ ok: true, msg: "정상적으로 연결되었습니다." });
    } catch (e) {
      console.error(e);
      setTestResult({
        ok: false,
        msg: "검증에 실패했습니다. 키/권한/네트워크를 확인하세요.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const nextKey = input.trim();
    if (nextKey) setGeminiApiKey(nextKey);
    setInput("");
    setTestResult(null);
    onClose();
  };

  const handleClear = () => {
    setGeminiApiKey(null);
    setInput("");
    setTestResult(null);
  };

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
            className="w-full max-w-lg bg-surface border border-gray-800 rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-200 font-serif font-bold">
                <FaKey className="text-primary" />
                <span>Gemini API 키 (BYOK)</span>
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
              <div className="text-sm text-gray-500 leading-relaxed">
                키는 브라우저의 localStorage에만 저장되며, 서버로 전송하지 않습니다.
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                  현재 키
                </label>
                <div className="text-sm text-gray-300 bg-black/30 border border-gray-800 rounded px-3 py-2">
                  {masked ?? "없음"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                  새 키 입력
                </label>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  type="password"
                  placeholder="AIza... 형태의 키를 붙여넣으세요"
                  className="w-full bg-gray-900 border border-gray-700 rounded-md py-3 px-3 text-gray-200 focus:outline-none focus:border-primary transition-colors"
                  autoFocus
                />
              </div>

              {testResult && (
                <div
                  className={`text-sm rounded border px-3 py-2 ${
                    testResult.ok
                      ? "border-emerald-900 bg-emerald-900/10 text-emerald-300"
                      : "border-red-900 bg-red-900/10 text-red-300"
                  }`}
                >
                  {testResult.msg}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-800 flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded text-gray-300 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-60"
              >
                <FaVial />
                {isTesting ? "검증 중..." : "키 검증"}
              </button>

              <button
                onClick={handleClear}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
              >
                <FaTrash />
                삭제
              </button>

              <button
                onClick={handleSave}
                className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors"
              >
                <FaCheck />
                저장
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
