"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/useUserStore";
import AppLogoLink from "@/components/app/AppLogoLink";
import GeminiKeyModal from "@/components/builder/GeminiKeyModal";
import { AnimatePresence, motion } from "framer-motion";
import { FaChevronLeft, FaKey, FaUserShield } from "react-icons/fa";
import { doc, increment, serverTimestamp, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { HeroClass } from "@/types/hero";
import type { UserProfile } from "@/types/user";
import HeroClassIcon from "@/components/hero/HeroClassIcon";
import {
  deriveHeroCombatStats,
  HERO_CLASS_LABEL,
  HERO_CLASS_ROLE,
  HERO_CLASS_TRAIT,
} from "@/lib/hero";

export default function HeroClient({ initialUser }: { initialUser: UserProfile }) {
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [pickClassOpen, setPickClassOpen] = useState<HeroClass | null>(null);
  const [savingClass, setSavingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [savingUpgrade, setSavingUpgrade] = useState(false);

  const storeUid = useUserStore((s) => s.uid);
  const storeAuthed = useUserStore((s) => s.isAuthenticated);
  const storeNickname = useUserStore((s) => s.nickname);
  const storeStats = useUserStore((s) => s.stats);
  const storeResources = useUserStore((s) => s.resources);
  const geminiApiKey = useUserStore((s) => s.geminiApiKey);
  const storeHeroClass = useUserStore((s) => s.heroClass);
  const setHeroClass = useUserStore((s) => s.setHeroClass);
  const setStats = useUserStore((s) => s.setStats);
  const addResources = useUserStore((s) => s.addResources);
  const storeMetaPassives = useUserStore((s) => s.metaPassives);
  const setMetaPassives = useUserStore((s) => s.setMetaPassives);

  const uid = storeUid ?? initialUser.uid;
  const nickname =
    storeAuthed && storeUid ? (storeNickname ?? initialUser.nickname) : initialUser.nickname;
  const stats = storeAuthed && storeUid ? storeStats : initialUser.stats;
  const resources = storeAuthed && storeUid ? storeResources : initialUser.resources;
  const heroClass = storeAuthed && storeUid ? storeHeroClass : initialUser.hero_class;
  const metaPassives = storeAuthed && storeUid ? storeMetaPassives : initialUser.meta_passives;

  const derived = useMemo(
    () => (heroClass ? deriveHeroCombatStats(stats, heroClass) : null),
    [stats, heroClass],
  );

  const classes: HeroClass[] = ["WARRIOR", "ROGUE", "MAGE", "RANGER", "CLERIC"];
  const STAT_BASE = 10;
  const STAT_MAX_BONUS = 3; // keeps meta progression subtle in UGC
  const statCostTable = [220, 520, 980]; // per stat level (0->1, 1->2, 2->3)
  const statBonus = {
    str: Math.max(0, stats.str - STAT_BASE),
    dex: Math.max(0, stats.dex - STAT_BASE),
    int: Math.max(0, stats.int - STAT_BASE),
    luck: Math.max(0, stats.luck - STAT_BASE),
  };
  const startHpBonus = Math.max(0, Math.min(3, metaPassives.startHpLv)) * 5;
  const startMpBonus = Math.max(0, Math.min(2, metaPassives.startMpLv)) * 5;
  const startPotionBonus = Math.max(0, Math.min(1, metaPassives.startPotionLv));

  const upgradeStat = async (key: "str" | "dex" | "int" | "luck") => {
    if (!uid) {
      window.alert("로그인이 필요합니다.");
      return;
    }
    if (savingUpgrade) return;
    const curLv = statBonus[key];
    if (curLv >= STAT_MAX_BONUS) return;
    const cost = statCostTable[curLv] ?? 999999;
    if (resources.gold < cost) {
      window.alert("보유 골드가 부족합니다.");
      return;
    }
    setSavingUpgrade(true);
    try {
      await updateDoc(doc(db, "users", uid), {
        [`stats.${key}`]: increment(1),
        "resources.gold": increment(-cost),
        lastUpgradeAt: serverTimestamp(),
      });
      addResources({ gold: -cost });
      setStats({ ...stats, [key]: stats[key] + 1 });
    } catch (e) {
      console.error(e);
      window.alert("업그레이드에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSavingUpgrade(false);
    }
  };

  const upgradePassive = async (id: "START_HP" | "START_MP" | "START_POTION") => {
    if (!uid) {
      window.alert("로그인이 필요합니다.");
      return;
    }
    if (savingUpgrade) return;

    const config =
      id === "START_HP"
        ? {
            label: "시작 HP +5",
            lv: metaPassives.startHpLv,
            max: 3,
            costs: [260, 560, 980],
            field: "meta_passives.start_hp_lv",
            apply: () => setMetaPassives({ ...metaPassives, startHpLv: metaPassives.startHpLv + 1 }),
          }
        : id === "START_MP"
          ? {
              label: "시작 MP +5",
              lv: metaPassives.startMpLv,
              max: 2,
              costs: [260, 560],
              field: "meta_passives.start_mp_lv",
              apply: () => setMetaPassives({ ...metaPassives, startMpLv: metaPassives.startMpLv + 1 }),
            }
          : {
              label: "시작 포션 +1",
              lv: metaPassives.startPotionLv,
              max: 1,
              costs: [1200],
              field: "meta_passives.start_potion_lv",
              apply: () =>
                setMetaPassives({
                  ...metaPassives,
                  startPotionLv: metaPassives.startPotionLv + 1,
                }),
            };

    if (config.lv >= config.max) return;
    const cost = config.costs[config.lv] ?? 999999;
    if (resources.gold < cost) {
      window.alert("보유 골드가 부족합니다.");
      return;
    }
    setSavingUpgrade(true);
    try {
      await updateDoc(doc(db, "users", uid), {
        [config.field]: increment(1),
        "resources.gold": increment(-cost),
        lastUpgradeAt: serverTimestamp(),
      });
      addResources({ gold: -cost });
      config.apply();
    } catch (e) {
      console.error(e);
      window.alert("업그레이드에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSavingUpgrade(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-main font-serif">
      <header className="h-16 border-b border-gray-800 bg-surface/90 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 sm:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-2 text-gray-200 font-bold min-w-0">
          <FaUserShield className="text-primary" />
          <span>영웅</span>
        </div>
        <AppLogoLink className="justify-self-center" />
        <Link
          href="/"
          className="justify-self-end w-fit p-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          title="로비로"
        >
          <FaChevronLeft />
        </Link>
      </header>

      <main className="max-w-5xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 grid gap-6 md:grid-cols-2">
        <section className="md:col-span-2 border border-gray-800 bg-surface/60 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-gray-300 font-bold">클래스</div>
              <div className="mt-1 text-sm text-gray-500">
                한 번 선택하면 전직할 수 없습니다.
              </div>
            </div>
            <div className="text-xs text-gray-600 font-mono uppercase tracking-wider">
              hero
            </div>
          </div>

          {classError && (
            <div className="mt-4 text-sm rounded border border-red-900 bg-red-900/10 text-red-300 px-3 py-2">
              {classError}
            </div>
          )}

          {heroClass ? (
            <div className="mt-5 flex items-center gap-4 border border-gray-800 bg-black/30 rounded-lg p-4">
              <div className="w-16 h-16 text-primary">
                <HeroClassIcon heroClass={heroClass} className="w-16 h-16" />
              </div>
              <div className="min-w-0">
                <div className="text-gray-200 font-bold">
                  {HERO_CLASS_LABEL[heroClass]}
                </div>
                <div className="text-sm text-gray-500">
                  {HERO_CLASS_ROLE[heroClass]}
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  {HERO_CLASS_TRAIT[heroClass]}
                </div>
              </div>
              <div className="ml-auto text-xs px-2 py-1 rounded border border-gray-800 text-gray-400">
                전직 불가
              </div>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {classes.map((c) => {
                const preview = deriveHeroCombatStats(stats, c);
                return (
                  <button
                    key={c}
                    onClick={() => {
                      setClassError(null);
                      setPickClassOpen(c);
                    }}
                    className="text-left border border-gray-800 bg-black/30 rounded-lg p-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 text-primary">
                        <HeroClassIcon heroClass={c} className="w-10 h-10" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-gray-200 font-bold truncate">
                          {HERO_CLASS_LABEL[c]}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {HERO_CLASS_ROLE[c]}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <MiniStat label="HP" value={preview.maxHp} />
                      <MiniStat label="MP" value={preview.maxMp} />
                      <MiniStat label="ATK" value={preview.atk} />
                      <MiniStat label="SPD" value={preview.spd} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="border border-gray-800 bg-surface/60 rounded-lg p-6">
          <div className="text-gray-200 font-bold text-lg">
            {nickname ?? "모험가"}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            현재 메타 진행은 최소 기능으로만 연결되어 있습니다.
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="bg-black/30 border border-gray-800 rounded p-3">
              <div className="text-gray-500">골드</div>
              <div className="text-gray-200 font-bold">{resources.gold}</div>
            </div>
            <div className="bg-black/30 border border-gray-800 rounded p-3">
              <div className="text-gray-500">에센스</div>
              <div className="text-gray-200 font-bold">{resources.essence}</div>
            </div>
          </div>
        </section>

        <section className="border border-gray-800 bg-surface/60 rounded-lg p-6">
          <div className="text-sm text-gray-300 font-bold">기초 스탯</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Stat label="STR" value={stats.str} />
            <Stat label="DEX" value={stats.dex} />
            <Stat label="INT" value={stats.int} />
            <Stat label="LUK" value={stats.luck} />
          </div>

          <div className="mt-6 text-sm text-gray-300 font-bold">전투 스탯</div>
          {derived ? (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="HP" value={derived.maxHp} />
              <Stat label="MP" value={derived.maxMp} />
              <Stat label="ATK" value={derived.atk} />
              <Stat label="DEF" value={derived.def} />
              <Stat label="SPD" value={derived.spd} />
              <Stat label="LUK" value={derived.luk} />
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-600">
              클래스를 선택하면 전투 스탯이 계산됩니다.
            </div>
          )}
        </section>

        <section className="md:col-span-2 border border-gray-800 bg-surface/60 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-gray-300 font-bold">영웅 업그레이드</div>
              <div className="mt-1 text-sm text-gray-500">
                UGC 밸런스를 위해 강화 폭은 작게 제한됩니다. (스탯: 최대 +{STAT_MAX_BONUS})
              </div>
            </div>
            <div className="text-xs text-gray-600 font-mono uppercase tracking-wider">
              meta
            </div>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div className="border border-gray-800 bg-black/30 rounded-lg p-4">
              <div className="text-sm text-gray-200 font-bold">스탯 강화</div>
              <div className="mt-1 text-xs text-gray-600">
                각 스탯은 최대 +{STAT_MAX_BONUS}까지. (비용은 스탯별로 증가)
              </div>

              <div className="mt-4 grid gap-2">
                {(
                  [
                    { key: "str" as const, label: "STR", value: stats.str, bonus: statBonus.str },
                    { key: "dex" as const, label: "DEX", value: stats.dex, bonus: statBonus.dex },
                    { key: "int" as const, label: "INT", value: stats.int, bonus: statBonus.int },
                    { key: "luck" as const, label: "LUK", value: stats.luck, bonus: statBonus.luck },
                  ] as const
                ).map((s) => {
                  const atCap = s.bonus >= STAT_MAX_BONUS;
                  const cost = statCostTable[s.bonus] ?? 0;
                  const canPay = resources.gold >= cost;
                  return (
                    <div
                      key={s.key}
                      className="flex items-center justify-between gap-3 bg-gray-900/40 border border-gray-800 rounded px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500">{s.label}</div>
                        <div className="text-sm text-gray-200 font-bold">
                          {s.value}{" "}
                          <span className="text-xs text-gray-500">
                            (+{Math.min(s.bonus, STAT_MAX_BONUS)})
                          </span>
                        </div>
                      </div>
                      <button
                        disabled={savingUpgrade || atCap || !canPay}
                        onClick={() => upgradeStat(s.key)}
                        className="px-3 py-2 rounded border text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed border-primary/40 text-primary hover:bg-primary/10"
                        title={atCap ? "최대치" : `${cost}G`}
                      >
                        {atCap ? "최대" : `강화 (${cost}G)`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border border-gray-800 bg-black/30 rounded-lg p-4">
              <div className="text-sm text-gray-200 font-bold">패시브</div>
              <div className="mt-1 text-xs text-gray-600">
                던전 시작 보정(작은 이점). 던전 밖으로 장비/버프는 가져올 수 없습니다.
              </div>

              <div className="mt-4 grid gap-2">
                <PassiveRow
                  title="시작 HP"
                  desc={`던전 시작 시 최대 HP +${startHpBonus}`}
                  lv={metaPassives.startHpLv}
                  max={3}
                  cost={[260, 560, 980][metaPassives.startHpLv] ?? null}
                  disabled={savingUpgrade}
                  canPay={(cost) => (cost !== null ? resources.gold >= cost : true)}
                  onBuy={() => upgradePassive("START_HP")}
                />
                <PassiveRow
                  title="시작 MP"
                  desc={`던전 시작 시 최대 MP +${startMpBonus}`}
                  lv={metaPassives.startMpLv}
                  max={2}
                  cost={[260, 560][metaPassives.startMpLv] ?? null}
                  disabled={savingUpgrade}
                  canPay={(cost) => (cost !== null ? resources.gold >= cost : true)}
                  onBuy={() => upgradePassive("START_MP")}
                />
                <PassiveRow
                  title="시작 포션"
                  desc={`던전 시작 시 포션 +${startPotionBonus}`}
                  lv={metaPassives.startPotionLv}
                  max={1}
                  cost={[1200][metaPassives.startPotionLv] ?? null}
                  disabled={savingUpgrade}
                  canPay={(cost) => (cost !== null ? resources.gold >= cost : true)}
                  onBuy={() => upgradePassive("START_POTION")}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="md:col-span-2 border border-gray-800 bg-surface/60 rounded-lg p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-gray-300 font-bold">Gemini 키</div>
              <div className="mt-1 text-sm text-gray-500">
                {geminiApiKey ? "설정됨" : "미설정"}
              </div>
            </div>
            <button
              onClick={() => setKeyModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors"
            >
              <FaKey />
              <span>키 관리</span>
            </button>
          </div>
        </section>
      </main>

      <GeminiKeyModal open={keyModalOpen} onClose={() => setKeyModalOpen(false)} />

      <AnimatePresence>
        {pickClassOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => (savingClass ? null : setPickClassOpen(null))}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="w-full max-w-lg bg-surface border border-gray-800 rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-800">
                <div className="text-gray-200 font-bold">클래스 확정</div>
                <div className="mt-1 text-sm text-gray-500">
                  확정하면 전직할 수 없습니다.
                </div>
              </div>

              <div className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 text-primary">
                  <HeroClassIcon heroClass={pickClassOpen} className="w-14 h-14" />
                </div>
                <div className="min-w-0">
                  <div className="text-gray-200 font-bold">
                    {HERO_CLASS_LABEL[pickClassOpen]}
                  </div>
                  <div className="text-sm text-gray-500">
                    {HERO_CLASS_ROLE[pickClassOpen]}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {HERO_CLASS_TRAIT[pickClassOpen]}
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-gray-800 flex flex-col sm:flex-row gap-2">
                <button
                  disabled={savingClass}
                  onClick={() => setPickClassOpen(null)}
                  className="px-4 py-2 bg-gray-900 border border-gray-700 rounded text-gray-300 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  disabled={savingClass}
                  onClick={async () => {
                    if (!uid) {
                      setClassError("로그인이 필요합니다.");
                      setPickClassOpen(null);
                      return;
                    }
                    setSavingClass(true);
                    setClassError(null);
                    try {
                      await setDoc(
                        doc(db, "users", uid),
                        {
                          hero_class: pickClassOpen,
                          hero_created_at: serverTimestamp(),
                        },
                        { merge: true },
                      );
                      setHeroClass(pickClassOpen);
                      setPickClassOpen(null);
                    } catch (e) {
                      console.error(e);
                      setClassError("클래스 저장에 실패했습니다. 다시 시도하세요.");
                      setPickClassOpen(null);
                    } finally {
                      setSavingClass(false);
                    }
                  }}
                  className="sm:ml-auto px-4 py-2 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors disabled:opacity-60"
                >
                  {savingClass ? "저장 중..." : "확정"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-black/30 border border-gray-800 rounded p-3 flex items-center justify-between">
      <div className="text-gray-500">{label}</div>
      <div className="text-gray-200 font-bold">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded px-2 py-1">
      <div className="text-gray-600">{label}</div>
      <div className="text-gray-200 font-bold">{value}</div>
    </div>
  );
}

function PassiveRow({
  title,
  desc,
  lv,
  max,
  cost,
  disabled,
  canPay,
  onBuy,
}: {
  title: string;
  desc: string;
  lv: number;
  max: number;
  cost: number | null;
  disabled: boolean;
  canPay: (cost: number | null) => boolean;
  onBuy: () => void;
}) {
  const atCap = lv >= max;
  const afford = canPay(cost);
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded px-3 py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-gray-200 font-bold">{title}</div>
        <div className="mt-1 text-xs text-gray-600">{desc}</div>
        <div className="mt-1 text-[11px] text-gray-500 font-mono">
          Lv {Math.min(lv, max)} / {max}
        </div>
      </div>
      <button
        disabled={disabled || atCap || !afford}
        onClick={onBuy}
        className="px-3 py-2 rounded border text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed border-primary/40 text-primary hover:bg-primary/10"
        title={atCap ? "최대치" : cost !== null ? `${cost}G` : ""}
      >
        {atCap ? "최대" : cost !== null ? `구매 (${cost}G)` : "구매"}
      </button>
    </div>
  );
}
