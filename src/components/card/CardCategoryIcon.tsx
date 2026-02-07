"use client";

import {
  GiAnvil,
  GiCampfire,
  GiChest,
  GiCrystalShrine,
  GiDragonHead,
  GiGargoyle,
  GiRat,
  GiShop,
  GiSwordsEmblem,
  GiTrapMask,
} from "react-icons/gi";
import { FaCrown } from "react-icons/fa";

export default function CardCategoryIcon({
  category,
  className,
  title,
}: {
  category: string;
  className?: string;
  title?: string;
}) {
  const props = {
    className,
    title,
    "aria-hidden": title ? undefined : true,
  } as const;

  if (category.includes("ENEMY_SINGLE")) return <GiDragonHead {...props} />;
  if (category.includes("ENEMY_SQUAD")) return <GiRat {...props} />;
  if (category.includes("BOSS")) return <FaCrown {...props} />;
  if (category.includes("TRAP")) return <GiTrapMask {...props} />;
  if (category.includes("LOOT")) return <GiChest {...props} />;
  if (category.includes("SHRINE")) return <GiCrystalShrine {...props} />;
  if (category.includes("REST_CAMPFIRE")) return <GiCampfire {...props} />;
  if (category.includes("REST_SMITHY")) return <GiAnvil {...props} />;
  if (category.includes("REST_STATUE")) return <GiGargoyle {...props} />;
  if (category.includes("REST")) return <GiCampfire {...props} />;
  if (category.includes("NPC")) return <GiShop {...props} />;
  return <GiSwordsEmblem {...props} />;
}
