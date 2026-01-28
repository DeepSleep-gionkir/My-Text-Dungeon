"use client";

import type { ReactNode } from "react";

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

export function ShrineRewardIcon({
  rewardType,
  className,
}: {
  rewardType: string;
  className?: string;
}) {
  switch (rewardType) {
    case "STAT_ATK_UP":
      return (
        <Base className={className}>
          <path d="M32 10v34" />
          <path d="M24 18h16" />
          <path d="M28 48h8" />
          <path d="M24 52l8-8l8 8" />
        </Base>
      );
    case "STAT_DEF_UP":
      return (
        <Base className={className}>
          <path d="M32 7l18 7v17c0 14-8 23-18 28c-10-5-18-14-18-28V14l18-7z" />
          <path d="M24 30h16" />
          <path d="M32 24v18" />
        </Base>
      );
    case "STAT_SPD_UP":
      return (
        <Base className={className}>
          <path d="M16 40c10-10 18-16 32-18" />
          <path d="M16 40c8 0 14 2 18 6" />
          <path d="M34 46c6 0 10-2 14-6" />
          <path d="M38 22l10 2l-6 8" />
        </Base>
      );
    case "STAT_MAXHP_PCT_UP":
      return (
        <Base className={className}>
          <path d="M32 52s-16-9-20-22c-2-7 2-14 9-15c5-1 9 2 11 6c2-4 6-7 11-6c7 1 11 8 9 15c-4 13-20 22-20 22z" />
          <path d="M32 24v10" />
          <path d="M27 29h10" />
        </Base>
      );
    case "HEAL_FULL":
      return (
        <Base className={className}>
          <path d="M32 52s-16-9-20-22c-2-7 2-14 9-15c5-1 9 2 11 6c2-4 6-7 11-6c7 1 11 8 9 15c-4 13-20 22-20 22z" />
          <path d="M32 22v14" />
          <path d="M25 29h14" />
        </Base>
      );
    case "CLEANSE":
      return (
        <Base className={className}>
          <path d="M32 10c8 10 14 18 14 26c0 8-6 14-14 14s-14-6-14-14c0-8 6-16 14-26z" />
          <path d="M18 20l-6 6" />
          <path d="M46 20l6 6" />
          <path d="M20 52l4-4" />
          <path d="M44 52l-4-4" />
        </Base>
      );
    case "GAIN_GOLD":
      return (
        <Base className={className}>
          <ellipse cx="32" cy="22" rx="16" ry="8" />
          <path d="M16 22v18c0 4 7 8 16 8s16-4 16-8V22" />
          <path d="M22 30h20" />
        </Base>
      );
    case "GAIN_ITEM":
      return (
        <Base className={className}>
          <path d="M16 26l16-10l16 10v22H16V26z" />
          <path d="M16 26l16 10l16-10" />
          <path d="M28 30h8" />
        </Base>
      );
    case "GAIN_RELIC_SHARD":
      return (
        <Base className={className}>
          <path d="M32 8l12 12l-8 28H28l-8-28L32 8z" />
          <path d="M24 20h16" />
          <path d="M26 34h12" />
        </Base>
      );
    case "RESET_COOLDOWN":
      return (
        <Base className={className}>
          <path d="M24 10h16" />
          <path d="M24 54h16" />
          <path d="M26 10c0 14 12 14 12 22S26 40 26 54" />
          <path d="M38 10c0 14-12 14-12 22s12 8 12 22" />
        </Base>
      );
    case "RESURRECT_TOKEN":
      return (
        <Base className={className}>
          <path d="M32 10v44" />
          <path d="M22 24h20" />
          <path d="M24 44c4 6 12 6 16 0" />
          <path d="M26 12c4-3 8-3 12 0" />
        </Base>
      );
    case "ALL_STATS_UP":
      return (
        <Base className={className}>
          <path d="M32 10l6 14l15 2l-11 10l3 15l-13-8l-13 8l3-15L11 26l15-2l6-14z" />
        </Base>
      );
    default:
      return (
        <Base className={className}>
          <path d="M32 10l6 14l15 2l-11 10l3 15l-13-8l-13 8l3-15L11 26l15-2l6-14z" />
        </Base>
      );
  }
}

export function ShrineCostIcon({
  costType,
  className,
}: {
  costType: string;
  className?: string;
}) {
  switch (costType) {
    case "HP_FLAT":
      return (
        <Base className={className}>
          <path d="M32 10c8 10 14 18 14 26c0 8-6 14-14 14s-14-6-14-14c0-8 6-16 14-26z" />
          <path d="M32 22v10" />
        </Base>
      );
    case "MAXHP_PCT_DOWN":
      return (
        <Base className={className}>
          <path d="M32 52s-16-9-20-22c-2-7 2-14 9-15c5-1 9 2 11 6c2-4 6-7 11-6c7 1 11 8 9 15c-4 13-20 22-20 22z" />
          <path d="M22 22l20 20" />
        </Base>
      );
    case "DEF_DOWN":
      return (
        <Base className={className}>
          <path d="M32 7l18 7v17c0 14-8 23-18 28c-10-5-18-14-18-28V14l18-7z" />
          <path d="M22 22l20 20" />
        </Base>
      );
    case "MP_FLAT":
      return (
        <Base className={className}>
          <path d="M32 10c8 10 14 18 14 26c0 8-6 14-14 14s-14-6-14-14c0-8 6-16 14-26z" />
          <path d="M22 30h20" />
        </Base>
      );
    case "GOLD_FLAT":
      return (
        <Base className={className}>
          <ellipse cx="32" cy="22" rx="16" ry="8" />
          <path d="M16 22v18c0 4 7 8 16 8s16-4 16-8V22" />
          <path d="M24 34h16" />
        </Base>
      );
    case "ADD_DEBUFF_BLEED":
      return (
        <Base className={className}>
          <path d="M32 10c8 10 14 18 14 26c0 8-6 14-14 14s-14-6-14-14c0-8 6-16 14-26z" />
          <path d="M30 44c0 4-2 6-6 6" />
        </Base>
      );
    case "ADD_DEBUFF_BLIND":
      return (
        <Base className={className}>
          <path d="M12 32c6-10 12-14 20-14s14 4 20 14c-6 10-12 14-20 14s-14-4-20-14z" />
          <path d="M22 42l20-20" />
          <path d="M32 28c2 0 4 2 4 4" />
        </Base>
      );
    case "ADD_DEBUFF_WEAK":
      return (
        <Base className={className}>
          <path d="M18 40c6-6 10-12 14-20c6 4 10 8 14 14c-6 6-12 10-20 14c-4-2-6-4-8-8z" />
          <path d="M20 46l-6 6" />
        </Base>
      );
    case "SUMMON_ENEMY":
      return (
        <Base className={className}>
          <path d="M20 26c0-6 5-10 12-10s12 4 12 10" />
          <path d="M22 46c2-6 7-10 10-10s8 4 10 10" />
          <path d="M24 28h0" />
          <path d="M40 28h0" />
          <path d="M28 32h8" />
        </Base>
      );
    case "DESTROY_ITEM":
      return (
        <Base className={className}>
          <path d="M16 26l16-10l16 10v22H16V26z" />
          <path d="M20 44l24-24" />
        </Base>
      );
    case "TIME_PENALTY":
      return (
        <Base className={className}>
          <circle cx="32" cy="32" r="18" />
          <path d="M32 20v12l8 6" />
          <path d="M22 12l4 4" />
          <path d="M42 12l-4 4" />
        </Base>
      );
    case "NO_COST":
      return (
        <Base className={className}>
          <circle cx="32" cy="32" r="18" />
          <path d="M26 32h12" />
        </Base>
      );
    default:
      return (
        <Base className={className}>
          <circle cx="32" cy="32" r="18" />
          <path d="M26 32h12" />
        </Base>
      );
  }
}

