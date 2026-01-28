"use client";

import type { IconType } from "react-icons";
import {
  GiCampfire,
  GiChest,
  GiDragonHead,
  GiHolySymbol,
  GiRat,
  GiShop,
  GiSwordsEmblem,
  GiTrapMask,
} from "react-icons/gi";
import { FaCrown } from "react-icons/fa";

const pickIcon = (category: string): IconType => {
  if (category.includes("ENEMY_SINGLE")) return GiDragonHead;
  if (category.includes("ENEMY_SQUAD")) return GiRat;
  if (category.includes("BOSS")) return FaCrown;
  if (category.includes("TRAP")) return GiTrapMask;
  if (category.includes("LOOT")) return GiChest;
  if (category.includes("SHRINE")) return GiHolySymbol;
  if (category.includes("REST")) return GiCampfire;
  if (category.includes("NPC")) return GiShop;
  return GiSwordsEmblem;
};

export default function CardCategoryIcon({
  category,
  className,
  title,
}: {
  category: string;
  className?: string;
  title?: string;
}) {
  const Icon = pickIcon(category);
  return <Icon className={className} title={title} aria-hidden={title ? undefined : true} />;
}

