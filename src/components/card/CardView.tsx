"use client";

import { CardData } from "@/types/card";
import { motion } from "framer-motion";
import { FaSkull } from "react-icons/fa";
import CardCategoryIcon from "@/components/card/CardCategoryIcon";
import KeywordIcon from "@/components/keyword/KeywordIcon";

interface CardViewProps {
  card: CardData;
  className?: string;
  onClick?: () => void;
  runtime?: {
    hp?: number;
    maxHp?: number;
  };
}

const getCategoryLabel = (category: string) => {
  const map: Record<string, string> = {
    CARD_ENEMY_SINGLE: "단일 몬스터",
    CARD_ENEMY_SQUAD: "몬스터 무리",
    CARD_BOSS: "보스",
    CARD_TRAP_INSTANT: "즉발 함정",
    CARD_TRAP_ROOM: "환경 함정",
    CARD_LOOT_CHEST: "보물 상자",
    CARD_SHRINE: "제단",
    CARD_EVENT_CHOICE: "이벤트",
    CARD_NPC_TRADER: "상인",
    CARD_NPC_QUEST: "의뢰",
    CARD_NPC_TALK: "대화",
    CARD_REST_CAMPFIRE: "휴식처",
    CARD_REST_SMITHY: "대장간",
    CARD_REST_STATUE: "여신상",
  };
  return map[category] ?? category.replace("CARD_", "").replaceAll("_", " ");
};

const getBorderColor = (grade: string) => {
  switch (grade) {
    case "NORMAL":
      return "border-gray-500";
    case "ELITE":
      return "border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]";
    case "BOSS":
      return "border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.6)]";
    case "EPIC":
      return "border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]";
    case "LEGENDARY":
      return "border-amber-600 shadow-[0_0_25px_rgba(217,119,6,0.8)]";
    default:
      return "border-gray-500";
  }
};

export default function CardView({
  card,
  className = "",
  onClick,
  runtime,
}: CardViewProps) {
  const isMonster =
    card.category.includes("ENEMY") || card.category.includes("BOSS");
  const runtimeHp =
    typeof runtime?.hp === "number" && Number.isFinite(runtime.hp) ? Math.round(runtime.hp) : null;
  const runtimeMaxHp =
    typeof runtime?.maxHp === "number" && Number.isFinite(runtime.maxHp)
      ? Math.round(runtime.maxHp)
      : null;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`relative w-64 h-96 bg-black border-2 ${getBorderColor(card.grade)} rounded-lg p-4 flex flex-col gap-4 select-none cursor-pointer overflow-hidden ${className}`}
      onClick={onClick}
    >
      {/* Background Texture/Pattern overlay */}
      <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>

      {/* Header: Name & Grade */}
      <div className="z-10 text-center border-b border-gray-800 pb-2">
        <h3 className="text-lg font-serif font-bold text-gray-100 truncate">
          {card.name}
        </h3>
        <span className="text-xs text-gray-500 font-serif tracking-widest">
          {getCategoryLabel(card.category)}
        </span>
      </div>

      {/* Top Icon */}
      <div className="z-10 flex items-center justify-center flex-1 text-6xl text-gray-300 relative">
        {/* Glow effect behind icon */}
        <div className="absolute inset-0 bg-gradient-radial from-gray-800 to-transparent opacity-40 blur-xl"></div>
        <div className="z-10 drop-shadow-lg">
          <CardCategoryIcon category={card.category} />
        </div>
      </div>

      {/* Stats (If Monster) */}
      {isMonster && card.stats && (
        <div className="z-10 grid grid-cols-2 gap-2 text-sm bg-gray-900/50 p-2 rounded border border-gray-800">
          <div className="flex justify-between text-red-400">
            <span>ATK</span> <span>{card.stats.atk}</span>
          </div>
          <div className="flex justify-between text-green-400">
            <span>HP</span>{" "}
            <span>
              {runtimeHp !== null && runtimeMaxHp !== null
                ? `${runtimeHp}/${runtimeMaxHp}`
                : card.stats.hp}
            </span>
          </div>
          <div className="flex justify-between text-blue-400">
            <span>SPD</span> <span>{card.stats.spd}</span>
          </div>
          <div className="flex justify-between text-yellow-400">
            <span>DEF</span> <span>{card.stats.def}</span>
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="z-10 flex flex-wrap gap-1 justify-center">
        {card.tags.slice(0, 10).map((tag) => (
          <span
            key={tag}
            title={tag}
            className="w-7 h-7 flex items-center justify-center bg-gray-900/60 text-gray-300 rounded border border-gray-800"
          >
            <KeywordIcon id={tag} className="w-4 h-4" />
          </span>
        ))}
      </div>

      {/* Description */}
      <div className="z-10 bg-black/40 p-2 rounded border border-gray-800 h-24 overflow-hidden">
        <p className="text-xs text-gray-400 italic leading-relaxed line-clamp-4">
          &quot;{card.description}&quot;
        </p>
      </div>

      {/* Card Rank Icon */}
      {card.grade === "BOSS" && (
        <div className="absolute top-2 right-2 text-yellow-500 text-xl animate-pulse">
          <FaSkull />
        </div>
      )}
    </motion.div>
  );
}
