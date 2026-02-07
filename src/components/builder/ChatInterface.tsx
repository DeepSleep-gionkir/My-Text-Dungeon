"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPaperPlane, FaMagic, FaHistory, FaKey } from "react-icons/fa";
import { generateGeminiJSON } from "@/lib/gemini";
import { useUserStore } from "@/store/useUserStore";
import { CardData } from "@/types/card";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import GeminiKeyModal from "@/components/builder/GeminiKeyModal";
import type { Difficulty, PrimaryCategory } from "@/types/builder";
import { mapBuilderSelectionToCardCategory } from "@/lib/builderCardMapping";
import { normalizeCardData } from "@/lib/normalizeCard";

interface ChatInterfaceProps {
  onCardGenerated: (card: CardData) => void | Promise<void>;
  selectedCategory: PrimaryCategory | null;
  selectedSubCategory: string | null;
  difficulty: Difficulty;
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export default function ChatInterface({
  onCardGenerated,
  selectedCategory,
  selectedSubCategory,
  difficulty,
}: ChatInterfaceProps) {
  const geminiApiKey = useUserStore((s) => s.geminiApiKey);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [input, setInput] = useState("");
  const isComposingRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "던전 설계자여, 오늘은 무엇을 만들까요?",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const needsSubCategory =
    selectedCategory === "MONSTER" ||
    selectedCategory === "TRAP" ||
    selectedCategory === "NPC" ||
    selectedCategory === "REST";
  const isCategoryReady =
    Boolean(selectedCategory) && (!needsSubCategory || Boolean(selectedSubCategory));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    // Prevent the common KR-IME bug where the last composed character "sticks" after send.
    if (isComposingRef.current) return;
    if (!geminiApiKey) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "Gemini API 키가 필요합니다. 우측 상단에서 키를 입력하세요.",
        },
      ]);
      setKeyModalOpen(true);
      return;
    }
    if (!isCategoryReady) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "카테고리(그리고 필요한 경우 세부 유형)를 먼저 선택하세요.",
        },
      ]);
      return;
    }

    const userMsg = input;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsTyping(true);

    try {
      if (!selectedCategory) throw new Error("카테고리를 선택하세요.");
      const forcedCategory = mapBuilderSelectionToCardCategory(
        selectedCategory,
        selectedSubCategory,
      );
      const validateGenerated = (raw: unknown): string | null => {
        if (!raw || typeof raw !== "object") return "JSON이 객체가 아닙니다.";
        const r = raw as Record<string, unknown>;
        const cat = typeof r.category === "string" ? r.category : "";
        if (cat && cat !== forcedCategory) {
          return `category가 "${cat}" 입니다. "${forcedCategory}" 이어야 합니다.`;
        }

        const name = typeof r.name === "string" ? r.name.trim() : "";
        if (!name) return "name이 비어있습니다.";

        const isMonster =
          forcedCategory.includes("CARD_ENEMY") || forcedCategory === "CARD_BOSS";
        if (isMonster) {
          const stats = r.stats as Record<string, unknown> | undefined;
          const hp = stats && typeof stats.hp === "number" ? stats.hp : null;
          const atk = stats && typeof stats.atk === "number" ? stats.atk : null;
          const def = stats && typeof stats.def === "number" ? stats.def : null;
          const spd = stats && typeof stats.spd === "number" ? stats.spd : null;
          if ([hp, atk, def, spd].some((v) => v === null)) return "stats가 누락되었습니다.";

          const actions = r.actions as unknown;
          if (!Array.isArray(actions) || actions.length < 1) return "actions가 누락되었습니다.";
          if (forcedCategory === "CARD_BOSS" && actions.length < 2)
            return "보스는 actions가 2개 이상이어야 합니다.";
        }

        const isTrap =
          forcedCategory === "CARD_TRAP_INSTANT" || forcedCategory === "CARD_TRAP_ROOM";
        if (isTrap) {
          const ci = r.check_info as Record<string, unknown> | undefined;
          const stat = ci && typeof ci.stat === "string" ? ci.stat : null;
          const dc = ci && typeof ci.difficulty === "number" ? ci.difficulty : null;
          if (!stat || dc === null) return "check_info가 누락되었습니다.";
        }

        if (forcedCategory === "CARD_SHRINE") {
          const opts = r.options as unknown;
          if (!Array.isArray(opts) || opts.length !== 5) return "options가 5개가 아닙니다.";
        }

        if (forcedCategory === "CARD_NPC_TRADER") {
          const list = r.trade_list as unknown;
          if (!Array.isArray(list) || list.length < 3)
            return "trade_list가 누락되었습니다. (3개 이상 필요)";
          if (list.length > 6) return "trade_list가 6개를 초과합니다.";
          for (const rawIt of list) {
            if (!rawIt || typeof rawIt !== "object")
              return "trade_list 항목이 올바르지 않습니다.";
            const it = rawIt as Record<string, unknown>;
            const id = typeof it.id === "string" ? it.id.trim() : "";
            const price = typeof it.price === "number" ? it.price : null;
            if (!id) return "trade_list.id가 비어있습니다.";
            if (price === null || !Number.isFinite(price))
              return "trade_list.price가 올바르지 않습니다.";
          }
        }

        return null;
      };

      const buildPrompt = (reason?: string) => {
        const regen =
          reason && reason.trim().length
            ? `\n\n[Regenerate]\nThe previous output violated the rules: ${reason}\nRegenerate from scratch.\n`
            : "";

        return `${SYSTEM_PROMPT}\n\n[Context]\n- difficulty: ${difficulty}\n- builder_primary_category: ${selectedCategory}\n- builder_sub_category: ${selectedSubCategory ?? "NONE"}\n- forced_category: ${forcedCategory}\n${regen}\n[User Request]\n"${userMsg}"\n\nGenerate the JSON card data:`;
      };

      let raw: unknown = null;
      let lastReason: string | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        raw = await generateGeminiJSON(geminiApiKey, buildPrompt(lastReason ?? undefined));
        lastReason = validateGenerated(raw);
        if (!lastReason) break;
      }

      const cardData: CardData = normalizeCardData(raw, forcedCategory, difficulty);

      await Promise.resolve(onCardGenerated(cardData));
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `[Created] ${cardData.name} (${cardData.category})`,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content:
            "Creation failed: " +
            (error instanceof Error ? error.message : "Unknown error"),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface border-r border-gray-800">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-800 bg-black/20 flex items-center justify-between">
        <span className="font-serif font-bold text-gray-300 flex items-center gap-2">
          <FaMagic className="text-primary" /> 설계 콘솔
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setKeyModalOpen(true)}
            className={`p-2 rounded border transition-colors ${
              geminiApiKey
                ? "border-gray-800 text-gray-400 hover:text-white hover:border-gray-600"
                : "border-primary/50 text-primary hover:bg-primary/10"
            }`}
            title={geminiApiKey ? "Gemini API 키 설정" : "Gemini API 키가 필요합니다"}
          >
            <FaKey />
          </button>
          <button className="text-gray-500 hover:text-white transition-colors">
            <FaHistory />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: msg.role === "user" ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 text-sm ${
                  msg.role === "user"
                    ? "bg-indigo-900/50 text-indigo-100 border border-indigo-800"
                    : msg.role === "system"
                      ? "bg-red-900/20 text-red-400 border border-red-900"
                      : "bg-gray-800/50 text-gray-300 border border-gray-700"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-gray-800/30 rounded-lg p-3 text-xs text-gray-500 italic flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                생성 중...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/40 border-t border-gray-800">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              setInput(e.currentTarget.value);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              // IME composition: ignore Enter until the composition is committed.
              const native = e.nativeEvent as unknown as { isComposing?: boolean };
              if (native?.isComposing || isComposingRef.current) return;
              handleSend();
            }}
            placeholder={
              !geminiApiKey
                ? "Gemini API 키를 먼저 설정하세요..."
                : !isCategoryReady
                  ? "카테고리를 선택하세요..."
                  : "카드 컨셉을 입력하세요 (예: 얼음 송곳니 늑대)"
            }
            disabled={!geminiApiKey || !isCategoryReady}
            className="w-full input-surface py-3 pl-4 pr-12 text-gray-200"
            aria-label="카드 컨셉 입력"
            autoComplete="off"
            maxLength={240}
          />
          <button
            onClick={handleSend}
            disabled={!geminiApiKey || !isCategoryReady || !input.trim() || isTyping}
            className="absolute right-2 top-2 p-2 text-gray-400 hover:text-primary disabled:opacity-50 transition-colors"
          >
            <FaPaperPlane />
          </button>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {["고블린 무리", "화염 함정", "전설의 검", "치유의 제단"].map(
            (tag) => (
              <button
                key={tag}
                onClick={() => setInput(tag)}
                disabled={!geminiApiKey || !isCategoryReady}
                className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 whitespace-nowrap text-gray-400"
              >
                {tag}
              </button>
            ),
          )}
        </div>
      </div>

      <GeminiKeyModal open={keyModalOpen} onClose={() => setKeyModalOpen(false)} />
    </div>
  );
}
