"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  GiDragonHead,
  GiBossKey,
  GiTrapMask,
  GiHolySymbol,
  GiChest,
  GiConversation,
  GiCampfire,
} from "react-icons/gi";

import type { PrimaryCategory } from "@/types/builder";
type SubCategory = string | null;

interface CategorySelectorProps {
  onCategorySelect: (
    category: PrimaryCategory,
    subCategory: SubCategory,
  ) => void;
  selectedCategory: PrimaryCategory | null;
  selectedSubCategory: SubCategory;
}

const categories: {
  id: PrimaryCategory;
  label: string;
  icon: React.ReactNode;
  subCategories?: { id: string; label: string }[];
}[] = [
  {
    id: "MONSTER",
    label: "몬스터",
    icon: <GiDragonHead />,
    subCategories: [
      { id: "SINGLE", label: "단일 개체" },
      { id: "SQUAD", label: "군단/무리" },
    ],
  },
  { id: "BOSS", label: "보스", icon: <GiBossKey /> },
  {
    id: "TRAP",
    label: "함정",
    icon: <GiTrapMask />,
    subCategories: [
      { id: "INSTANT", label: "즉발형" },
      { id: "ROOM", label: "환경형" },
    ],
  },
  { id: "SHRINE", label: "제단", icon: <GiHolySymbol /> },
  { id: "TREASURE", label: "보물", icon: <GiChest /> },
  {
    id: "NPC",
    label: "NPC",
    icon: <GiConversation />,
    subCategories: [
      { id: "TRADER", label: "상인" },
      { id: "QUEST", label: "의뢰" },
      { id: "TALK", label: "대화" },
    ],
  },
  {
    id: "REST",
    label: "휴식",
    icon: <GiCampfire />,
    subCategories: [
      { id: "CAMPFIRE", label: "모닥불" },
      { id: "SMITHY", label: "대장간" },
      { id: "STATUE", label: "여신상" },
    ],
  },
];

export default function CategorySelector({
  onCategorySelect,
  selectedCategory,
  selectedSubCategory,
}: CategorySelectorProps) {
  const handleCategoryClick = (cat: PrimaryCategory) => {
    // Always select the primary category first.
    // If the category has sub-categories, the user must pick one to finish.
    onCategorySelect(cat, null);
  };

  const handleSubCategoryClick = (subCat: string) => {
    if (selectedCategory) {
      onCategorySelect(selectedCategory, subCat);
    }
  };

  const currentCategoryData = categories.find((c) => c.id === selectedCategory);
  const needsSubCategory = Boolean(currentCategoryData?.subCategories?.length);
  const isReady =
    Boolean(selectedCategory) && (!needsSubCategory || Boolean(selectedSubCategory));

  return (
    <div className="space-y-4">
      {/* Step 1: Primary Category */}
      <div>
        <h4 className="text-xs text-gray-500 mb-2 font-mono uppercase tracking-wider">
          1단계: 카테고리
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((cat) => (
            <motion.button
              key={cat.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCategoryClick(cat.id)}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                selectedCategory === cat.id
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600"
              }`}
            >
              <span className="text-2xl mb-1">{cat.icon}</span>
              <span className="text-xs">{cat.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Step 2: Sub-Category (if applicable) */}
      <AnimatePresence>
        {currentCategoryData?.subCategories && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h4 className="text-xs text-gray-500 mb-2 font-mono uppercase tracking-wider">
              2단계: 세부 유형
            </h4>
            <div className="flex gap-2">
              {currentCategoryData.subCategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => handleSubCategoryClick(sub.id)}
                  className={`flex-1 py-2 px-4 rounded border text-sm transition-colors ${
                    selectedSubCategory === sub.id
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Indicator */}
      <div className="text-xs text-gray-600 pt-2 border-t border-gray-800">
        {isReady ? (
          <span className="text-green-500">
            준비 완료: {selectedCategory}
            {selectedSubCategory ? ` / ${selectedSubCategory}` : ""}
          </span>
        ) : (
          <span>카테고리를 선택하세요</span>
        )}
      </div>
    </div>
  );
}
