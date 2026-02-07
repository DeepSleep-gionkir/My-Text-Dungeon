"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppLogoLink from "@/components/app/AppLogoLink";
import type { Difficulty } from "@/types/builder";
import type { UserProfile } from "@/types/user";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import {
  FaChevronLeft,
  FaEdit,
  FaFlask,
  FaHammer,
  FaSearch,
  FaSignOutAlt,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import {
  GiCastleRuins,
  GiDeathSkull,
  GiDungeonGate,
  GiScrollUnfurled,
  GiWoodenDoor,
} from "react-icons/gi";

export type MyDungeonListItem = {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  room_count: number;
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

export default function MyDungeonsClient({
  initialUser,
  initialItems,
  initialError = null,
}: {
  initialUser: UserProfile;
  initialItems: MyDungeonListItem[];
  initialError?: string | null;
}) {
  type DifficultyFilter = Difficulty | "ALL";

  const router = useRouter();
  const [items] = useState<MyDungeonListItem[]>(initialItems);
  const [error] = useState<string | null>(initialError);
  const [q, setQ] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("ALL");

  const storeUid = useUserStore((s) => s.uid);
  const storeAuthed = useUserStore((s) => s.isAuthenticated);
  const storeNickname = useUserStore((s) => s.nickname);

  const nickname =
    storeAuthed && storeUid ? (storeNickname ?? initialUser.nickname) : initialUser.nickname;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((d) => {
      if (difficultyFilter !== "ALL" && d.difficulty !== difficultyFilter) return false;
      const hay = `${d.name} ${d.description ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [difficultyFilter, items, q]);

  const visible = useMemo(() => {
    if (q.trim()) return filtered;
    if (difficultyFilter === "ALL") return items;
    return items.filter((d) => d.difficulty === difficultyFilter);
  }, [difficultyFilter, filtered, items, q]);

  return (
    <div className="min-h-screen bg-background text-text-main font-serif">
      <header className="h-16 border-b border-gray-800 bg-surface/90 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 sm:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-lg font-bold text-gray-200 min-w-0">
          <Link
            href="/"
            className="p-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            title="로비로"
          >
            <FaChevronLeft aria-hidden />
          </Link>
          <GiScrollUnfurled className="text-primary" />
          <span className="hidden sm:inline">내 던전</span>
          <span className="sm:hidden">내 던전</span>
        </div>

        <AppLogoLink className="justify-self-center" />

        <div className="flex items-center justify-end gap-2">
          <Link
            href="/builder"
            aria-label="새 던전 제작"
            className="text-sm px-3 py-2 bg-primary/10 border border-primary/40 rounded text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-2"
          >
            <FaHammer aria-hidden />
            <span className="hidden sm:inline">새 던전</span>
          </Link>
          <button
            onClick={async () => {
              try {
                await signOut(auth);
                await fetch("/api/logout", { method: "POST" }).catch(() => {});
              } catch (e) {
                console.error(e);
              } finally {
                useUserStore.getState().logout();
              }
              router.push("/login");
            }}
            className="p-2 rounded border border-gray-800 text-gray-400 hover:text-red-300 hover:border-gray-600 transition-colors"
            title={`${nickname ?? "모험가"} 로그아웃`}
            aria-label="로그아웃"
          >
            <FaSignOutAlt aria-hidden />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col gap-3">
          <div className="text-gray-400">
            내 던전{" "}
            <span className="text-gray-200 font-bold">{visible.length}</span>개
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="relative w-full md:w-[360px]">
              <FaSearch className="absolute left-3 top-3.5 text-gray-600" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="이름/설명 검색"
                className="w-full input-surface py-3 pl-10 pr-3 text-gray-200"
              />
            </div>
            <div className="grid grid-cols-5 gap-2 w-full md:w-auto">
              {[
                { id: "ALL", label: "전체" },
                { id: "EASY", label: "쉬움" },
                { id: "NORMAL", label: "보통" },
                { id: "HARD", label: "어려움" },
                { id: "NIGHTMARE", label: "악몽" },
              ].map((opt) => {
                const active = difficultyFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setDifficultyFilter(opt.id as DifficultyFilter)}
                    className={`px-3 py-2 rounded border text-xs transition-colors ${
                      active
                        ? "border-primary/50 text-primary bg-primary/10"
                        : "border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="border border-red-900 bg-red-900/10 text-red-300 rounded px-4 py-3">
            {error}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="panel-surface rounded-lg p-8 text-center text-gray-500">
            아직 게시한 던전이 없습니다. 제작 탭에서 던전을 만들어 보세요.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((d) => {
              const diff = difficultyVisual(d.difficulty);
              const Icon = diff.Icon;
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group"
                >
                  <div
                    className={`block relative aspect-square panel-surface panel-surface-hover p-3 sm:p-4 overflow-hidden ${diff.frameCls}`}
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
                        <div className="mt-2 text-[11px] text-gray-600 line-clamp-2">
                          {d.description || "설명이 없습니다."}
                        </div>
                      </div>

                      <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-gray-600">
                        <span>플레이 {d.play_count ?? 0}</span>
                        <span>좋아요 {d.likes ?? 0}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Link
                          href={`/builder?edit=${encodeURIComponent(d.id)}`}
                          className="px-3 py-2 rounded border border-gray-800 bg-black/30 text-gray-200 hover:border-gray-600 transition-colors inline-flex items-center justify-center gap-2 text-xs"
                          title="수정"
                        >
                          <FaEdit aria-hidden />
                          <span>수정</span>
                        </Link>
                        <Link
                          href={`/play/${encodeURIComponent(d.id)}?test=1`}
                          prefetch={false}
                          className="px-3 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 transition-colors inline-flex items-center justify-center gap-2 text-xs"
                          title="테스트(보상 없음)"
                        >
                          <FaFlask aria-hidden />
                          <span>테스트</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
