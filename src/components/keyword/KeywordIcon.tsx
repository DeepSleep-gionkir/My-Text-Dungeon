"use client";

import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  GiAcid,
  GiAngryEyes,
  GiAngelWings,
  GiAnimalSkull,
  GiAppleMaggot,
  GiAtom,
  GiBackstab,
  GiBat,
  GiBeehive,
  GiBleedingHeart,
  GiBleedingWound,
  GiBrain,
  GiBrainTentacle,
  GiBroadsword,
  GiBrokenHeart,
  GiBrokenShield,
  GiBlindfold,
  GiBubbles,
  GiChargingBull,
  GiCheckedShield,
  GiCharm,
  GiCirclingFish,
  GiCrackedShield,
  GiCrestedHelmet,
  GiCrossedSwords,
  GiCrosshair,
  GiCursedStar,
  GiDevilMask,
  GiDivingHelmet,
  GiDodge,
  GiDoorway,
  GiExplosionRays,
  GiFire,
  GiFog,
  GiFrozenOrb,
  GiGasMask,
  GiGears,
  GiGhost,
  GiGiant,
  GiGuillotine,
  GiHammerDrop,
  GiHeartShield,
  GiHealing,
  GiHealthDecrease,
  GiHealthIncrease,
  GiHolySymbol,
  GiHoodedAssassin,
  GiHorseHead,
  GiLava,
  GiLightningFrequency,
  GiMaceHead,
  GiMagicPortal,
  GiMagicShield,
  GiMagnet,
  GiMedusaHead,
  GiMirrorMirror,
  GiMoon,
  GiMountains,
  GiMuscleUp,
  GiOgre,
  GiPawPrint,
  GiPerson,
  GiPlantRoots,
  GiPoisonGas,
  GiPortal,
  GiReturnArrow,
  GiRobber,
  GiRootTip,
  GiRunningShoe,
  GiSacrificialDagger,
  GiScreaming,
  GiShouting,
  GiSilenced,
  GiSlime,
  GiSnail,
  GiSnowflake1,
  GiSoundWaves,
  GiSpearHook,
  GiSpiderWeb,
  GiSpiralArrow,
  GiSpottedBug,
  GiStarsStack,
  GiStunGrenade,
  GiThornHelix,
  GiTornado,
  GiVampireDracula,
  GiVolcano,
  GiWaterDrop,
  GiWolfHead,
  GiDragonHead,
  GiSleepy,
} from "react-icons/gi";

type KeywordKind =
  | "TAG"
  | "ATTR"
  | "STATUS"
  | "BUFF"
  | "LOGIC"
  | "TARGET"
  | "ENV"
  | "WEAK"
  | "RESIST"
  | "IMMUNE"
  | "OTHER";

type IconComponent = (p: { className?: string }) => ReactNode;

function kindOf(id: string): KeywordKind {
  const s = id.trim().toUpperCase();
  if (s.startsWith("TAG_")) return "TAG";
  if (s.startsWith("ATTR_")) return "ATTR";
  if (s.startsWith("STATUS_")) return "STATUS";
  if (s.startsWith("BUFF_")) return "BUFF";
  if (s.startsWith("LOGIC_")) return "LOGIC";
  if (s.startsWith("TARGET_")) return "TARGET";
  if (s.startsWith("ENV_")) return "ENV";
  if (s.startsWith("WEAK_")) return "WEAK";
  if (s.startsWith("RESIST_")) return "RESIST";
  if (s.startsWith("IMMUNE_")) return "IMMUNE";
  return "OTHER";
}

function hashString(s: string): number {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function Base({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width="64"
      height="64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// --------- Icon presets (minimal, monochrome, consistent stroke style) ---------

function Flame({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M32 8c6 8 2 12 8 18c4 4 8 8 8 16c0 10-7 18-16 18S16 52 16 42c0-8 4-12 8-16c6-6 2-10 8-18z" />
      <path d="M28 30c2 3 0 5 2 8c2 3 6 4 6 9" />
    </Base>
  );
}

function Snowflake({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M32 8v48" />
      <path d="M12 20l40 24" />
      <path d="M52 20L12 44" />
      <path d="M26 14l6-6l6 6" />
      <path d="M26 50l6 6l6-6" />
      <path d="M14 26l-6 6l6 6" />
      <path d="M50 26l6 6l-6 6" />
    </Base>
  );
}

function Bolt({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M34 6L16 34h14l-4 24L48 30H34l4-24z" />
    </Base>
  );
}

function Droplet({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M32 8c10 12 16 22 16 32a16 16 0 1 1-32 0c0-10 6-20 16-32z" />
    </Base>
  );
}

function Skull({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M22 26c0-7 5-12 10-12s10 5 10 12c0 6-3 9-6 11v5H28v-5c-3-2-6-5-6-11z" />
      <path d="M26 30h0" />
      <path d="M38 30h0" />
      <path d="M28 44h8" />
      <path d="M30 48v-4" />
      <path d="M34 48v-4" />
    </Base>
  );
}

function EyeSlash({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M12 32c6-10 12-14 20-14s14 4 20 14c-6 10-12 14-20 14s-14-4-20-14z" />
      <path d="M24 24l16 16" />
      <path d="M28 32c0-2 2-4 4-4" />
    </Base>
  );
}

function Chain({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M26 22l-6 6c-4 4-4 10 0 14s10 4 14 0l4-4" />
      <path d="M38 42l6-6c4-4 4-10 0-14s-10-4-14 0l-4 4" />
      <path d="M28 36l8-8" />
    </Base>
  );
}

function Leaf({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M46 14c-18 0-28 10-28 28c0 6 4 10 10 10c18 0 28-10 28-28c0-6-4-10-10-10z" />
      <path d="M22 46c8-10 16-16 24-20" />
    </Base>
  );
}

function Paw({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M22 28c2-2 4-2 6 0" />
      <path d="M36 28c2-2 4-2 6 0" />
      <path d="M28 22c2-2 4-2 6 0" />
      <path d="M26 40c2-6 10-6 12 0c1 4-2 8-6 8s-7-4-6-8z" />
    </Base>
  );
}

function Gear({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="32" cy="32" r="10" />
      <path d="M32 10v6" />
      <path d="M32 48v6" />
      <path d="M10 32h6" />
      <path d="M48 32h6" />
      <path d="M17 17l4 4" />
      <path d="M43 43l4 4" />
      <path d="M47 17l-4 4" />
      <path d="M21 43l-4 4" />
    </Base>
  );
}

function Crosshair({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="32" cy="32" r="16" />
      <path d="M32 12v8" />
      <path d="M32 44v8" />
      <path d="M12 32h8" />
      <path d="M44 32h8" />
      <circle cx="32" cy="32" r="3" />
    </Base>
  );
}

function Shield({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M32 7l18 7v17c0 14-8 23-18 28c-10-5-18-14-18-28V14l18-7z" />
      <path d="M24 30h16" />
    </Base>
  );
}

function BrokenShield({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M32 7l18 7v17c0 14-8 23-18 28c-10-5-18-14-18-28V14l18-7z" />
      <path d="M32 14v10l-6 8l8 6l-2 12" />
    </Base>
  );
}

function Crown({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M14 26l10 10l8-14l8 14l10-10v22H14V26z" />
      <path d="M18 48h28" />
    </Base>
  );
}

function Moon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M40 10c-8 2-14 10-14 20s6 18 14 20c-12 2-24-7-24-20S28 8 40 10z" />
    </Base>
  );
}

function Cloud({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M22 44h22c6 0 10-4 10-10s-4-10-10-10c-1 0-2 0-3 .2C39 18 35 16 30 16c-7 0-12 5-12 12c-4 1-8 5-8 10c0 6 4 10 12 10z" />
    </Base>
  );
}

function Mountain({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M12 50l16-26l8 12l8-8l16 22H12z" />
      <path d="M28 24l6-10l6 10" />
    </Base>
  );
}

function Swirl({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M18 34c0-10 10-18 22-18c8 0 14 4 14 10c0 6-6 10-14 10h-6" />
      <path d="M34 36c-8 0-14 4-14 10c0 6 6 10 14 10c10 0 18-6 18-14" />
    </Base>
  );
}

function Rune({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M32 10l18 10v24L32 54L14 44V20L32 10z" />
      <path d="M24 24h16" />
      <path d="M32 20v24" />
      <path d="M24 40h16" />
    </Base>
  );
}

function Default({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M32 10l6 14l15 2l-11 10l3 15l-13-8l-13 8l3-15L11 26l15-2l6-14z" />
    </Base>
  );
}

// Prefer react-icons wherever possible; keep SVG presets as a consistent fallback.
const REACT_ICON_OVERRIDES: Record<string, IconType> = {
  // Attributes
  ATTR_ACID: GiAcid,
  ATTR_BLOOD: GiBleedingHeart,
  ATTR_BLUNT: GiMaceHead,
  ATTR_DARK: GiMoon,
  ATTR_EARTH: GiMountains,
  ATTR_FIRE: GiFire,
  ATTR_HOLY: GiHolySymbol,
  ATTR_ICE: GiSnowflake1,
  ATTR_LIGHTNING: GiLightningFrequency,
  ATTR_MENTAL: GiBrain,
  ATTR_PHYSICAL_BLUNT: GiMaceHead,
  ATTR_PHYSICAL_PIERCE: GiSpearHook,
  ATTR_PHYSICAL_SLASH: GiBroadsword,
  ATTR_PIERCE: GiSpearHook,
  ATTR_POISON: GiPoisonGas,
  ATTR_SLASH: GiBroadsword,
  ATTR_SOUND: GiSoundWaves,
  ATTR_VOID: GiPortal,
  ATTR_WATER: GiWaterDrop,
  ATTR_WIND: GiTornado,

  // Buffs
  BUFF_BERSERK: GiAngryEyes,
  BUFF_ENRAGE: GiAngryEyes,
  BUFF_EVASION: GiDodge,
  BUFF_IRON_SKIN: GiCheckedShield,
  BUFF_MIGHT: GiMuscleUp,
  BUFF_REFLECT: GiMirrorMirror,
  BUFF_REGEN: GiHealthIncrease,
  BUFF_STEALTH: GiHoodedAssassin,
  BUFF_THORNS: GiThornHelix,
  BUFF_VAMPIRISM: GiVampireDracula,

  // Environment
  ENV_COLD: GiSnowflake1,
  ENV_DARKNESS: GiMoon,
  ENV_ECHO: GiSoundWaves,
  ENV_HOLY_GROUND: GiHolySymbol,
  ENV_MAGMA: GiLava,
  ENV_MAGNETIC: GiMagnet,
  ENV_MAGNETIC_FIELD: GiMagnet,
  ENV_MIASMA: GiPoisonGas,
  ENV_MIST: GiFog,
  ENV_NARROW: GiDoorway,
  ENV_POISON: GiPoisonGas,
  ENV_POISON_MIST: GiGasMask,
  ENV_UNDERWATER: GiDivingHelmet,
  ENV_VOLCANO: GiVolcano,

  // Logic
  LOGIC_AOE: GiExplosionRays,
  LOGIC_AOE_ALL: GiExplosionRays,
  LOGIC_ATTACK: GiCrossedSwords,
  LOGIC_BUFF: GiMuscleUp,
  LOGIC_BUFF_SELF: GiMuscleUp,
  LOGIC_CHARGE: GiChargingBull,
  LOGIC_CLEANSE: GiBubbles,
  LOGIC_COUNTERS: GiReturnArrow,
  LOGIC_COUNTER_MAGIC: GiMagicShield,
  LOGIC_DEBUFF_TARGET: GiBrokenShield,
  LOGIC_ENRAGE_50: GiAngryEyes,
  LOGIC_EXECUTE: GiGuillotine,
  LOGIC_FLEE: GiRunningShoe,
  LOGIC_FLEE_LOW_HP: GiRunningShoe,
  LOGIC_HEAL: GiHealing,
  LOGIC_HEAL_SELF_30: GiHealing,
  LOGIC_HEAVY_STRIKE: GiHammerDrop,
  LOGIC_MULTI_ATTACK: GiCrossedSwords,
  LOGIC_MULTI_HIT_X: GiCrossedSwords,
  LOGIC_SACRIFICE: GiSacrificialDagger,
  LOGIC_STEAL: GiRobber,
  LOGIC_STUN: GiStunGrenade,
  LOGIC_SUMMON: GiMagicPortal,
  LOGIC_SUMMON_DEATH: GiGhost,
  LOGIC_TAUNT: GiShouting,

  // Status
  STATUS_BERSERK: GiAngryEyes,
  STATUS_BLEED: GiBleedingWound,
  STATUS_BLEED_PERM: GiBleedingWound,
  STATUS_BLIND: GiBlindfold,
  STATUS_BURN: GiFire,
  STATUS_CHARM: GiCharm,
  STATUS_CHILL: GiSnowflake1,
  STATUS_CONFUSION: GiSpiralArrow,
  STATUS_CORROSION: GiAcid,
  STATUS_CURSE: GiCursedStar,
  STATUS_DESPAIR: GiBrokenHeart,
  STATUS_FEAR: GiScreaming,
  STATUS_FREEZE: GiFrozenOrb,
  STATUS_HEAVY_BURN: GiFire,
  STATUS_IMMUNE_INSTANT_DEATH: GiHeartShield,
  STATUS_PETRIFY: GiMedusaHead,
  STATUS_POISON: GiPoisonGas,
  STATUS_ROOT: GiRootTip,
  STATUS_ROT: GiAppleMaggot,
  STATUS_ROTTING: GiAppleMaggot,
  STATUS_SHOCK: GiLightningFrequency,
  STATUS_SILENCE: GiSilenced,
  STATUS_SLEEP: GiSleepy,
  STATUS_SLOW: GiSnail,
  STATUS_STUN: GiStarsStack,
  STATUS_TOXIC: GiPoisonGas,
  STATUS_VULNERABLE: GiCrackedShield,
  STATUS_WEAK: GiBrokenShield,
  STATUS_WEAKNESS: GiBrokenShield,
  STATUS_WET: GiWaterDrop,

  // Tags
  TAG_ABERRATION: GiBrainTentacle,
  TAG_AQUATIC: GiCirclingFish,
  TAG_BAT: GiBat,
  TAG_BEAST: GiPawPrint,
  TAG_CELESTIAL: GiAngelWings,
  TAG_CONSTRUCT: GiGears,
  TAG_DEMON: GiDevilMask,
  TAG_DRAGON: GiDragonHead,
  TAG_DULLAHAN: GiHorseHead,
  TAG_ELEMENTAL: GiAtom,
  TAG_ETHEREAL: GiGhost,
  TAG_FIRE_ELEMENTAL: GiFire,
  TAG_GIANT: GiGiant,
  TAG_HUMANOID: GiPerson,
  TAG_INSECT: GiSpottedBug,
  TAG_KNIGHT: GiCrestedHelmet,
  TAG_OGRE: GiOgre,
  TAG_PACK_TACTICS: GiWolfHead,
  TAG_PLANT: GiPlantRoots,
  TAG_SLIME: GiSlime,
  TAG_SPIDER: GiSpiderWeb,
  TAG_SPIRIT: GiGhost,
  TAG_SWARM: GiBeehive,
  TAG_UNDEAD: GiAnimalSkull,
  TAG_WEAK: GiBrokenShield,

  // Targeting
  TARGET_HEALER: GiHealthIncrease,
  TARGET_HIGHEST_ATK: GiCrossedSwords,
  TARGET_LOWEST_HP: GiHealthDecrease,
  TARGET_RANDOM: GiCrosshair,
  TARGET_REAR: GiBackstab,

  // Weakness
  WEAK_FIRE: GiFire,
};

const SVG_ICON_OVERRIDES: Record<string, IconComponent> = {
  // Attributes / elements
  ATTR_FIRE: Flame,
  ATTR_WATER: Droplet,
  ATTR_ICE: Snowflake,
  ATTR_LIGHTNING: Bolt,
  ATTR_EARTH: Mountain,
  ATTR_WIND: Swirl,
  ATTR_HOLY: Rune,
  ATTR_DARK: Moon,
  ATTR_POISON: Skull,
  ATTR_ACID: Rune,
  ATTR_SOUND: Swirl,
  ATTR_VOID: Rune,
  ATTR_BLOOD: Droplet,

  // Status (common)
  STATUS_BURN: Flame,
  STATUS_HEAVY_BURN: Flame,
  STATUS_POISON: Skull,
  STATUS_TOXIC: Skull,
  STATUS_BLEED: Droplet,
  STATUS_STUN: Bolt,
  STATUS_FREEZE: Snowflake,
  STATUS_CHILL: Snowflake,
  STATUS_SHOCK: Bolt,
  STATUS_BLIND: EyeSlash,
  STATUS_WEAK: BrokenShield,
  STATUS_VULNERABLE: BrokenShield,
  STATUS_SILENCE: Chain,
  STATUS_FEAR: Moon,
  STATUS_CURSE: Rune,

  // Buff (common)
  BUFF_REGEN: Leaf,
  BUFF_MIGHT: Crown,
  BUFF_IRON_SKIN: Shield,
  BUFF_REFLECT: Rune,
  BUFF_EVASION: Swirl,
  BUFF_STEALTH: EyeSlash,

  // Tags (common)
  TAG_BEAST: Paw,
  TAG_UNDEAD: Skull,
  TAG_CONSTRUCT: Gear,
  TAG_DRAGON: Crown,

  // Environment (common)
  ENV_DARKNESS: Moon,
  ENV_MIST: Cloud,
  ENV_MAGMA: Flame,
  ENV_HOLY_GROUND: Rune,

  // Combat targeting / logic
  TARGET_RANDOM: Crosshair,
  TARGET_LOWEST_HP: Crosshair,
  TARGET_HIGHEST_ATK: Crosshair,
};

const KIND_VARIANTS: Record<KeywordKind, IconComponent[]> = {
  TAG: [Paw, Skull, Gear, Crown, Leaf, Rune],
  ATTR: [Flame, Droplet, Snowflake, Bolt, Mountain, Swirl, Moon, Rune],
  STATUS: [Flame, Skull, Droplet, EyeSlash, Chain, Bolt, Snowflake, BrokenShield],
  BUFF: [Leaf, Shield, Crown, Swirl, Rune],
  LOGIC: [Gear, Rune, Crosshair],
  TARGET: [Crosshair, Rune],
  ENV: [Cloud, Moon, Mountain, Flame, Swirl],
  WEAK: [BrokenShield, Skull],
  RESIST: [Shield, Leaf],
  IMMUNE: [Shield, Rune],
  OTHER: [Default],
};

export default function KeywordIcon({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const key = id.trim().toUpperCase();
  const ReactIcon = REACT_ICON_OVERRIDES[key];
  if (ReactIcon) return <ReactIcon className={className} aria-hidden />;

  const svgOverride = SVG_ICON_OVERRIDES[key];
  if (svgOverride) return svgOverride({ className });

  const kind = kindOf(key);
  const variants = KIND_VARIANTS[kind] ?? KIND_VARIANTS.OTHER;
  const idx = variants.length ? hashString(key) % variants.length : 0;
  const Icon = variants[idx] ?? Default;
  return <Icon className={className} />;
}
