"use client";

import type { HeroClass } from "@/types/hero";
import type { IconType } from "react-icons";
import {
  GiBowArrow,
  GiCheckedShield,
  GiHolySymbol,
  GiHoodedAssassin,
  GiWizardStaff,
} from "react-icons/gi";

const HERO_CLASS_ICON: Record<HeroClass, IconType> = {
  WARRIOR: GiCheckedShield,
  ROGUE: GiHoodedAssassin,
  MAGE: GiWizardStaff,
  RANGER: GiBowArrow,
  CLERIC: GiHolySymbol,
};

export default function HeroClassIcon({
  heroClass,
  className,
}: {
  heroClass: HeroClass;
  className?: string;
}) {
  const Icon = HERO_CLASS_ICON[heroClass];
  return <Icon className={className} aria-hidden />;
}
