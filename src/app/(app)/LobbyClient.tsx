"use client";

import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  FaHome,
  FaHammer,
  FaUserShield,
  FaSignOutAlt,
  FaCoins,
  FaGem,
  FaEdit,
  FaFlask,
} from "react-icons/fa";
import AppLogoLink from "@/components/app/AppLogoLink";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Difficulty } from "@/types/builder";
import type { UserProfile } from "@/types/user";

type DungeonSummary = {
  id: string;
  name: string;
  difficulty: Difficulty;
  room_count: number;
  play_count?: number;
};

export default function LobbyClient({
  initialUser,
  initialMyDungeons,
  initialMyDungeonsError = null,
}: {
  initialUser: UserProfile;
  initialMyDungeons: DungeonSummary[];
  initialMyDungeonsError?: string | null;
}) {
  const router = useRouter();

  const storeUid = useUserStore((s) => s.uid);
  const storeAuthed = useUserStore((s) => s.isAuthenticated);
  const storeNickname = useUserStore((s) => s.nickname);
  const storeResources = useUserStore((s) => s.resources);

  const nickname =
    storeAuthed && storeUid ? (storeNickname ?? initialUser.nickname) : initialUser.nickname;
  const resources = storeAuthed && storeUid ? storeResources : initialUser.resources;

  const myDungeons = initialMyDungeons;
  const myDungeonsError = initialMyDungeonsError;

  return (
    <div className="min-h-screen bg-background text-text-main font-serif flex flex-col">
      {/* Header / GNB */}
      <header className="h-16 border-b border-gray-800 bg-surface/90 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 sm:px-6 sticky top-0 z-50">
        <div />

        <AppLogoLink className="justify-self-center" />

        <div className="flex items-center justify-end gap-3 sm:gap-6 text-sm min-w-0">
          {/* Resources */}
          <div className="hidden sm:flex items-center gap-4 bg-black/50 px-4 py-1 rounded-full border border-gray-800">
            <span className="flex items-center gap-1 text-primary">
              <FaCoins /> {resources?.gold ?? 0}
            </span>
            <span className="flex items-center gap-1 text-gray-300">
              <FaGem /> {resources?.essence ?? 0}
            </span>
          </div>
          <div className="sm:hidden flex items-center gap-2 text-xs bg-black/50 px-3 py-1 rounded-full border border-gray-800 text-primary">
            <FaCoins aria-hidden />
            <span className="tabular-nums">{resources?.gold ?? 0}</span>
          </div>

          {/* Profile */}
          <div className="flex items-center gap-3">
            <span className="text-gray-400 max-w-[120px] truncate hidden sm:inline">
              {nickname ?? "모험가"}
            </span>
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
              className="text-gray-500 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-6 max-w-7xl mx-auto w-full flex flex-col gap-8">
        {/* Welcome Section */}
        <section className="text-center py-10 space-y-4">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-200 via-gray-400 to-gray-600"
          >
            오늘은 어디로 향하시겠습니까?
          </motion.h2>
          <p className="text-gray-500 italic max-w-2xl mx-auto">
            &quot;던전은 끊임없이 변하고, 잉크는 아직 마르지 않았습니다. 길을
            고르거나, 직접 쓰십시오.&quot;
          </p>
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Explore */}
          <DashboardCard
            href="/explore"
            icon={<FaHome className="text-4xl mb-4 text-primary" />}
            title="탐험"
            desc="다른 제작자의 던전에 도전하세요. 승리하면 골드를 획득합니다."
            color="border-gray-800 hover:border-primary/60"
          />

          {/* Card 2: Workshop (Builder) */}
          <DashboardCard
            href="/builder"
            icon={<FaHammer className="text-4xl mb-4 text-primary" />}
            title="제작"
            desc="단어로 던전을 조립하고 게시하세요."
            color="border-primary/30 hover:border-primary"
            highlight
          />

          {/* Card 3: Hero */}
          <DashboardCard
            href="/hero"
            icon={<FaUserShield className="text-4xl mb-4 text-gray-200" />}
            title="영웅"
            desc="능력치와 소지품을 확인하고 다음 탐험을 준비하세요."
            color="border-gray-800 hover:border-gray-600"
          />
        </div>

        {/* My Dungeons */}
        <section className="border-t border-gray-800 pt-8">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <div className="text-gray-200 font-serif font-bold text-lg">내 던전</div>
              <div className="text-sm text-gray-600">내가 게시한 던전 목록입니다.</div>
            </div>
            <Link
              href="/my-dungeons"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              전체 보기
            </Link>
          </div>

          {myDungeonsError && (
            <div className="text-sm rounded border border-red-900 bg-red-900/10 text-red-300 px-3 py-2">
              {myDungeonsError}
            </div>
          )}

          {!myDungeonsError && myDungeons.length === 0 ? (
            <div className="text-sm text-gray-600 italic py-10 text-center">
              아직 게시한 던전이 없습니다. 제작 탭에서 던전을 만들어 보세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myDungeons.map((d) => (
                <div
                  key={d.id}
                  className="border border-gray-800 bg-surface/60 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-gray-200 font-bold truncate">{d.name}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {d.difficulty} · {d.room_count} 방
                        {typeof d.play_count === "number" ? ` · 플레이 ${d.play_count}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/builder?edit=${encodeURIComponent(d.id)}`}
                        className="text-xs px-3 py-2 rounded border border-gray-800 bg-black/30 text-gray-200 hover:border-gray-600 transition-colors inline-flex items-center gap-2"
                        title="수정"
                      >
                        <FaEdit aria-hidden />
                        <span className="hidden sm:inline">수정</span>
                      </Link>
                      <Link
                        href={`/play/${encodeURIComponent(d.id)}?test=1`}
                        prefetch={false}
                        className="text-xs px-3 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 transition-colors inline-flex items-center gap-2"
                        title="테스트(보상 없음)"
                      >
                        <FaFlask aria-hidden />
                        <span className="hidden sm:inline">테스트</span>
                      </Link>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-gray-600">
                    내 던전은 보상 플레이가 불가하며, 테스트는 보상이 지급되지 않습니다.
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function DashboardCard({
  href,
  icon,
  title,
  desc,
  color,
  highlight = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <motion.div
        whileHover={{ y: -5 }}
        className={`h-full flex flex-col items-center text-center p-8 bg-surface border ${color} rounded-lg transition-all duration-300 relative overflow-hidden`}
      >
        {highlight && <div className="absolute inset-0 bg-primary/5 pointer-events-none" />}
        <div className="z-10 bg-black/50 p-4 rounded-full mb-4 border border-gray-800 group-hover:border-gray-600 transition-colors">
          {icon}
        </div>
        <h3 className="z-10 text-2xl font-serif font-bold mb-2 group-hover:text-white text-gray-200 transition-colors">
          {title}
        </h3>
        <p className="z-10 text-gray-500 text-sm leading-relaxed">{desc}</p>
      </motion.div>
    </Link>
  );
}
