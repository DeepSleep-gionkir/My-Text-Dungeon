"use client";

import { CardData } from "@/types/card";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaEdit, FaSync } from "react-icons/fa";
import CardView from "@/components/card/CardView";
import { ShrineCostIcon, ShrineRewardIcon } from "@/components/shrine/ShrineOptionIcons";

interface CardDetailModalProps {
  card: CardData | null;
  onClose: () => void;
  onReroll?: () => void;
  onEdit?: () => void;
}

function shrineRewardLabel(type: string, value: unknown): string {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
  switch (type) {
    case "STAT_ATK_UP":
      return `공격력 +${n ?? 0}`;
    case "STAT_DEF_UP":
      return `방어력 +${n ?? 0}`;
    case "STAT_SPD_UP":
      return `속도 +${n ?? 0}`;
    case "STAT_MAXHP_PCT_UP":
      return `최대 HP +${n ?? 0}%`;
    case "HEAL_FULL":
      return "완전 회복";
    case "CLEANSE":
      return "정화";
    case "GAIN_GOLD":
      return `골드 +${n ?? 0}`;
    case "GAIN_ITEM":
      return typeof value === "string" ? `아이템: ${value}` : "아이템 획득";
    case "GAIN_RELIC_SHARD":
      return "유물 조각";
    case "RESET_COOLDOWN":
      return "쿨타임 초기화";
    case "RESURRECT_TOKEN":
      return "부활 토큰";
    case "ALL_STATS_UP":
      return `전투 스탯 +${n ?? 1}`;
    default:
      return type;
  }
}

function shrineCostLabel(type: string, value: unknown): string {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
  switch (type) {
    case "HP_FLAT":
      return `HP -${n ?? 0}`;
    case "MAXHP_PCT_DOWN":
      return `최대 HP -${n ?? 0}%`;
    case "DEF_DOWN":
      return `방어력 -${n ?? 0}`;
    case "MP_FLAT":
      return `MP -${n ?? 0}`;
    case "GOLD_FLAT":
      return `골드 -${n ?? 0}`;
    case "ADD_DEBUFF_BLEED":
      return "저주: 출혈";
    case "ADD_DEBUFF_BLIND":
      return "저주: 실명";
    case "ADD_DEBUFF_WEAK":
      return "저주: 약화";
    case "SUMMON_ENEMY":
      return "대가: 적 소환";
    case "DESTROY_ITEM":
      return "대가: 아이템 파괴";
    case "TIME_PENALTY":
      return "대가: 시간 손실";
    case "NO_COST":
      return "대가 없음";
    default:
      return type;
  }
}

export default function CardDetailModal({
  card,
  onClose,
  onReroll,
  onEdit,
}: CardDetailModalProps) {
  if (!card) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-surface border border-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-serif font-bold text-gray-200">
              카드 상세
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <FaTimes />
            </button>
          </div>

          {/* Content: Side by Side */}
          <div className="flex gap-6 flex-col md:flex-row">
            {/* Card Preview */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <CardView card={card} />
            </div>

            {/* Stats & Details */}
            <div className="flex-1 space-y-4">
              {/* Name & Category */}
              <div>
                <h3 className="text-2xl font-serif font-bold text-white">
                  {card.name}
                </h3>
                <p className="text-sm text-gray-500">{card.category}</p>
              </div>

              {/* Description */}
              <div className="bg-black/30 p-3 rounded border border-gray-800">
                <p className="text-gray-300 italic text-sm leading-relaxed">
                  &quot;{card.description}&quot;
                </p>
              </div>

              {/* Stats (if monster) */}
              {card.stats && (
                <div>
                  <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    스탯
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between bg-gray-900 p-2 rounded">
                      <span className="text-red-400">HP</span>
                      <span className="text-white">{card.stats.hp}</span>
                    </div>
                    <div className="flex justify-between bg-gray-900 p-2 rounded">
                      <span className="text-orange-400">ATK</span>
                      <span className="text-white">{card.stats.atk}</span>
                    </div>
                    <div className="flex justify-between bg-gray-900 p-2 rounded">
                      <span className="text-yellow-400">DEF</span>
                      <span className="text-white">{card.stats.def}</span>
                    </div>
                    <div className="flex justify-between bg-gray-900 p-2 rounded">
                      <span className="text-blue-400">SPD</span>
                      <span className="text-white">{card.stats.spd}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  태그
                </h4>
                <div className="flex flex-wrap gap-1">
                  {card.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              {card.actions && card.actions.length > 0 && (
                <div>
                  <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    행동 패턴
                  </h4>
                  <div className="space-y-2">
                    {card.actions.map((action, i) => (
                      <div
                        key={i}
                        className="text-xs bg-gray-900 p-2 rounded border border-gray-800"
                      >
                        <span className="text-primary">
                          [{action.trigger}]
                        </span>{" "}
                        {action.type}: {action.msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shrine Options */}
              {card.category === "CARD_SHRINE" && (
                <div>
                  <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    제단 선택지
                  </h4>
                  {card.options && card.options.length > 0 ? (
                    <div className="space-y-2">
                      {card.options.slice(0, 5).map((opt) => {
                        const rewardType = String(opt.reward_type);
                        const costType = String(opt.cost_type);
                        return (
                          <div
                            key={opt.id}
                            className="bg-gray-900 p-3 rounded border border-gray-800"
                          >
                            <div className="flex items-start gap-3">
                              <div className="shrink-0 flex items-center gap-2 pt-0.5">
                                <div className="w-8 h-8 text-primary">
                                  <ShrineRewardIcon
                                    rewardType={rewardType}
                                    className="w-8 h-8"
                                  />
                                </div>
                                <div className="w-8 h-8 text-red-300/90">
                                  <ShrineCostIcon
                                    costType={costType}
                                    className="w-8 h-8"
                                  />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm text-gray-200 font-semibold leading-snug">
                                  {opt.text}
                                </div>
                                <div className="mt-1 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                                  <span className="inline-flex items-center gap-1">
                                    <span className="text-primary">보상</span>
                                    <span className="text-gray-300">
                                      {shrineRewardLabel(rewardType, opt.reward_value)}
                                    </span>
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <span className="text-red-300">대가</span>
                                    <span className="text-gray-300">
                                      {shrineCostLabel(costType, opt.cost_value)}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 bg-black/20 border border-gray-800 rounded p-3">
                      선택지 데이터가 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t border-gray-800">
            {onReroll && (
              <button
                onClick={onReroll}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                <FaSync /> 재생성
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                <FaEdit /> 수정
              </button>
            )}
            <button
              onClick={onClose}
              className="ml-auto px-4 py-2 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors"
            >
              확인
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
