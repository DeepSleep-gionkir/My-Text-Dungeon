"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AppLogoLink from "@/components/app/AppLogoLink";
import type { Difficulty } from "@/types/builder";
import { FaArrowRight, FaHammer, FaSearch } from "react-icons/fa";
import type { IconType } from "react-icons";
import {
  GiCastleRuins,
  GiDeathSkull,
  GiDungeonGate,
  GiScrollUnfurled,
  GiWoodenDoor,
} from "react-icons/gi";
import { motion } from "framer-motion";

export type DungeonListItem = {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  room_count: number;
  creator_nickname?: string;
  likes?: number;
  play_count?: number;
};

function difficultyLabel(d: Difficulty) {
  switch (d) {
    case "EASY":
      return { label: "쉬움", cls: "border-emerald-900 text-emerald-300" };
    case "NORMAL":
      return { label: "보통", cls: "border-gray-700 text-gray-300" };
    case "HARD":
      return { label: "어려움", cls: "border-amber-900 text-amber-300" };
    case "NIGHTMARE":
      return { label: "악몽", cls: "border-red-900 text-red-300" };
  }
}

function difficultyVisual(d: Difficulty): {
  label: string;
  cls: string;
  Icon: IconType;
  iconCls: string;
  frameCls: string;
} {
  const base = difficultyLabel(d);
  if (d === "EASY") {
    return {
      ...base,
      Icon: GiWoodenDoor,
      iconCls: "text-emerald-300",
      frameCls: "border-emerald-900/80 hover:border-emerald-700/80",
    };
  }
  if (d === "HARD") {
    return {
      ...base,
      Icon: GiCastleRuins,
      iconCls: "text-amber-300",
      frameCls: "border-amber-900/80 hover:border-amber-700/80",
    };
  }
  if (d === "NIGHTMARE") {
    return {
      ...base,
      Icon: GiDeathSkull,
      iconCls: "text-red-300",
      frameCls: "border-red-900/80 hover:border-red-700/80",
    };
  }
  return {
    ...base,
    Icon: GiDungeonGate,
    iconCls: "text-gray-200",
    frameCls: "border-gray-700/80 hover:border-gray-500/80",
  };
}

export default function ExploreClient({
  initialItems,
  initialError = null,
}: {
  initialItems: DungeonListItem[];
  initialError?: string | null;
}) {
  const [items] = useState<DungeonListItem[]>(initialItems);
  const [error] = useState<string | null>(initialError);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((d) => {
      const hay = `${d.name} ${d.description ?? ""} ${d.creator_nickname ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  return (
    <div className="min-h-screen bg-background text-text-main font-serif">
      <header className="h-16 border-b border-gray-800 bg-surface/90 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-6 sticky top-0 z-40">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-200 min-w-0">
          <GiScrollUnfurled className="text-primary" />
          <span>던전 의뢰 게시판</span>
        </div>

        <AppLogoLink className="justify-self-center" />

        <div className="flex items-center justify-end">
          <Link
            href="/builder"
            aria-label="제작하러 가기"
            className="text-sm px-3 py-2 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-2"
          >
            <FaHammer aria-hidden />
            <span className="hidden sm:inline">제작하러 가기</span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="text-gray-400">
            최신 던전{" "}
            <span className="text-gray-200 font-bold">{filtered.length}</span>개
          </div>
          <div className="relative w-full md:w-[360px]">
            <FaSearch className="absolute left-3 top-3.5 text-gray-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름/설명/작성자 검색"
              className="w-full bg-gray-900 border border-gray-800 rounded-md py-3 pl-10 pr-3 text-gray-200 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="border border-red-900 bg-red-900/10 text-red-300 rounded px-4 py-3">
            {error}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="border border-gray-800 bg-surface/60 rounded-lg p-8 text-center text-gray-500">
            표시할 던전이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((d) => {
              const diff = difficultyVisual(d.difficulty);
              const Icon = diff.Icon;
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group"
                >
                  <Link
                    href={`/play/${d.id}`}
                    className={`block relative aspect-square border bg-surface/60 rounded-lg p-4 overflow-hidden transition-colors ${diff.frameCls}`}
                  >
                    <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/15 to-black/40 pointer-events-none" />

                    <div className="relative z-10 h-full flex flex-col min-w-0">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <span className={`text-[11px] px-2 py-1 rounded border ${diff.cls}`}>
                          {diff.label}
                        </span>
                        <span className="text-[11px] px-2 py-1 rounded border border-gray-800 text-gray-500">
                          방 {d.room_count}
                        </span>
                      </div>

                      <div className="relative mt-3 sm:mt-4 flex-1 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-radial from-white/6 to-transparent opacity-70 blur-xl" />
                        <Icon
                          className={`text-[64px] sm:text-[72px] drop-shadow-lg ${diff.iconCls}`}
                          aria-hidden
                        />
                      </div>

                      <div className="mt-3 min-w-0">
                        <div className="text-gray-200 font-bold truncate">{d.name}</div>
                        <div className="mt-1 text-xs text-gray-600 truncate">
                          {d.creator_nickname ?? "알 수 없음"}
                        </div>
                        <div className="mt-2 text-[11px] text-gray-600 line-clamp-2">
                          {d.description || "설명이 없습니다."}
                        </div>
                      </div>

                      <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-gray-600 pr-8">
                        <span>플레이 {d.play_count ?? 0}</span>
                        <span>좋아요 {d.likes ?? 0}</span>
                      </div>
                    </div>

                    <div className="absolute right-3 bottom-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <FaArrowRight aria-hidden />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

