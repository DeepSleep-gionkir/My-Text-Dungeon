"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChatInterface from "@/components/builder/ChatInterface";
import AppLogoLink from "@/components/app/AppLogoLink";
import CategorySelector from "@/components/builder/CategorySelector";
import CardDetailModal from "@/components/builder/CardDetailModal";
import PublishDungeonModal from "@/components/builder/PublishDungeonModal";
import DungeonSetupModal, {
  type DungeonSetup,
} from "@/components/builder/DungeonSetupModal";
import { CardData } from "@/types/card";
import { FaChevronLeft, FaCodeBranch, FaCog, FaInfoCircle, FaSave, FaTimes, FaTrash } from "react-icons/fa";
import type { Difficulty, PrimaryCategory } from "@/types/builder";
import { useUserStore } from "@/store/useUserStore";
import type { UserProfile } from "@/types/user";
import { ROOM_COUNT_BY_DIFFICULTY } from "@/lib/balancing";
import { AnimatePresence, motion } from "framer-motion";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { pruneUndefined } from "@/lib/pruneUndefined";
import CardCategoryIcon from "@/components/card/CardCategoryIcon";

type StoredCard = CardData & { _docId: string };

type StepSlot = CardData | null;
type Step =
  | { kind: "SINGLE"; slots: [StepSlot] }
  | { kind: "FORK"; slots: [StepSlot, StepSlot] };
type StepSlotRef = { stepIndex: number; slotIndex: 0 | 1 };

const STEP_LAYOUT_TRANSITION = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.8,
};

function CardMiniTile({
  card,
  className = "",
}: {
  card: CardData;
  className?: string;
}) {
  const badge =
    card.category.includes("BOSS")
      ? "bg-red-900/70 text-red-200"
      : card.category.includes("ENEMY")
        ? "bg-orange-900/70 text-orange-200"
        : card.category.includes("TRAP")
          ? "bg-purple-900/70 text-purple-200"
          : card.category.includes("SHRINE")
            ? "bg-primary/20 text-primary"
            : "bg-gray-800/70 text-gray-200";

  const label = card.category.replace("CARD_", "").split("_")[0] ?? "CARD";
  const iconTone =
    card.category.includes("BOSS")
      ? "text-red-200"
      : card.category.includes("ENEMY")
        ? "text-orange-200"
        : card.category.includes("TRAP")
          ? "text-purple-200"
          : card.category.includes("SHRINE")
            ? "text-primary"
            : card.category.includes("LOOT")
              ? "text-yellow-200"
              : card.category.includes("REST")
                ? "text-green-200"
                : card.category.includes("NPC")
                  ? "text-blue-200"
                  : "text-gray-200";

  return (
    <div
      className={`aspect-[3/4] rounded-lg border border-gray-800 bg-black/20 overflow-hidden ${className}`}
    >
      <div className="h-full w-full flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-gray-900/60 to-black/40">
        <div className={`text-[18px] ${iconTone}`}>
          <CardCategoryIcon category={card.category} />
        </div>
        <div className="text-[10px] text-gray-300 font-semibold truncate w-full">
          {card.name}
        </div>
        <div className={`mt-1 text-[9px] px-2 py-0.5 rounded ${badge}`}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function BuilderClient({
  initialUser,
  initialDeck,
}: {
  initialUser: UserProfile;
  initialDeck: StoredCard[];
}) {
  const router = useRouter();
  const storeUid = useUserStore((s) => s.uid);
  const storeAuthed = useUserStore((s) => s.isAuthenticated);
  const storeNickname = useUserStore((s) => s.nickname);

  const uid = storeUid ?? initialUser.uid;
  const nickname =
    storeAuthed && storeUid ? (storeNickname ?? initialUser.nickname) : initialUser.nickname;

  const defaultDifficulty: Difficulty = "NORMAL";

  const [setupOpen, setSetupOpen] = useState(true);
  const [setupMode, setSetupMode] = useState<"start" | "edit">("start");
  const [dungeonName, setDungeonName] = useState("");
  const [dungeonDescription, setDungeonDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>(defaultDifficulty);
  const [roomCount, setRoomCount] = useState(
    ROOM_COUNT_BY_DIFFICULTY[defaultDifficulty],
  );
  const makeDefaultSteps = (n: number): Step[] =>
    Array.from({ length: n }, () => ({ kind: "SINGLE", slots: [null] as [StepSlot] }));

  const [mobileView, setMobileView] = useState<"CHAT" | "LAYOUT" | "DECK">(
    "CHAT",
  );
  const [mobileDir, setMobileDir] = useState<1 | -1>(1);
  const switchMobileView = (next: "CHAT" | "LAYOUT" | "DECK") => {
    const order: Record<"CHAT" | "LAYOUT" | "DECK", number> = {
      CHAT: 0,
      LAYOUT: 1,
      DECK: 2,
    };
    setMobileDir(order[next] >= order[mobileView] ? 1 : -1);
    if (next !== "LAYOUT") {
      setMobilePickerOpen(false);
      setMobilePickerTarget(null);
    }
    setMobileView(next);
  };

  // Deck: Generated cards
  const [deck, setDeck] = useState<StoredCard[]>(() => initialDeck);
  // Steps: run length is fixed (roomCount). Each step is SINGLE(1 room) or FORK(2 rooms).
  const [steps, setSteps] = useState<Step[]>(() => makeDefaultSteps(roomCount));
  const [forkEditOn, setForkEditOn] = useState(false);

  // Category selection state
  const [selectedCategory, setSelectedCategory] =
    useState<PrimaryCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(
    null,
  );

  // Modal state
  const [detailCard, setDetailCard] = useState<CardData | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Drag state
  const [draggedCard, setDraggedCard] = useState<CardData | null>(null);
  const [selectedForPlacement, setSelectedForPlacement] = useState<CardData | null>(
    null,
  );
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const [mobilePickerTarget, setMobilePickerTarget] = useState<StepSlotRef | null>(
    null,
  );

  const DRAG_MIME = "application/x-text-dungeon-card";

  // 덱은 서버에서 프리패치하고, 생성/삭제는 로컬 state로 즉시 반영합니다.

  const applySetup = (next: DungeonSetup) => {
    setDungeonName(next.name);
    setDungeonDescription(next.description);
    setDifficulty(next.difficulty);
    setRoomCount(next.roomCount);
    setSteps(makeDefaultSteps(next.roomCount));
    setForkEditOn(false);
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setDraggedCard(null);
    setSelectedForPlacement(null);
    setPublishError(null);
    setSetupOpen(false);
    setSetupMode("edit");
  };

  const handleCategorySelect = (
    cat: PrimaryCategory,
    subCat: string | null,
  ) => {
    setSelectedCategory(cat);
    setSelectedSubCategory(subCat);
  };

  const handleCardGenerated = async (card: CardData) => {
    if (!uid) throw new Error("로그인이 필요합니다.");
    const payload = pruneUndefined({
      ...card,
      createdAt: serverTimestamp(),
    });
    const ref = await addDoc(collection(db, "users", uid, "cards"), payload);
    setDeck((prev) => [{ ...card, _docId: ref.id }, ...prev]);
  };

  const handleDragStart = (e: React.DragEvent, card: CardData) => {
    try {
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(card));
    } catch {
      // ignore (some browsers restrict certain MIME types)
      e.dataTransfer.setData("text/plain", JSON.stringify(card));
    }
    e.dataTransfer.effectAllowed = "copy";
    setDraggedCard(card);
  };

  const getSlot = (ref: StepSlotRef): StepSlot => {
    const step = steps[ref.stepIndex];
    if (!step) return null;
    if (step.kind === "SINGLE") return step.slots[0] ?? null;
    return step.slots[ref.slotIndex] ?? null;
  };

  const setSlot = (ref: StepSlotRef, nextCard: StepSlot) => {
    setSteps((prev) => {
      const step = prev[ref.stepIndex];
      if (!step) return prev;
      const next = prev.slice();
      if (step.kind === "SINGLE") {
        if (ref.slotIndex !== 0) return prev;
        next[ref.stepIndex] = { kind: "SINGLE", slots: [nextCard] };
        return next;
      }
      const slots = [...step.slots] as [StepSlot, StepSlot];
      slots[ref.slotIndex] = nextCard;
      next[ref.stepIndex] = { kind: "FORK", slots };
      return next;
    });
  };

  const handleDrop = (e: React.DragEvent, ref: StepSlotRef) => {
    e.preventDefault();

    let dropped: CardData | null = null;
    const raw = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData("text/plain");
    if (raw) {
      try {
        dropped = JSON.parse(raw) as CardData;
      } catch {
        dropped = null;
      }
    }

    const source = dropped ?? draggedCard;
    if (!source) return;
    setSlot(ref, { ...source }); // clone
    setDraggedCard(null);
  };

  const placeCardInSlot = (ref: StepSlotRef, card: CardData) => {
    setSlot(ref, { ...card });
  };

  const toggleForkStep = (stepIndex: number) => {
    const step = steps[stepIndex];
    if (!step) return;
    if (step.kind === "FORK" && step.slots[1]) {
      const ok = window.confirm(
        "갈림길을 해제하면 2번 방의 카드가 사라집니다.\n계속할까요?",
      );
      if (!ok) return;
    }
    setSteps((prev) => {
      const cur = prev[stepIndex];
      if (!cur) return prev;
      const next = prev.slice();
      if (cur.kind === "SINGLE") {
        next[stepIndex] = { kind: "FORK", slots: [cur.slots[0] ?? null, null] };
        return next;
      }
      next[stepIndex] = { kind: "SINGLE", slots: [cur.slots[0] ?? null] };
      return next;
    });
  };

  const handleMobileSlotClick = (ref: StepSlotRef) => {
    if (forkEditOn) {
      toggleForkStep(ref.stepIndex);
      return;
    }

    const slot = getSlot(ref);

    if (selectedForPlacement) {
      if (!slot) {
        placeCardInSlot(ref, selectedForPlacement);
        return;
      }
    }

    if (slot) {
      setDetailCard(slot);
      return;
    }

    setMobilePickerTarget(ref);
    setMobilePickerOpen(true);
  };

  const handleDeleteOwnedCard = async (card: StoredCard) => {
    if (!uid) return;
    if (!card._docId) return;
    const ok = window.confirm(`카드를 삭제할까요?\n\n${card.name}`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "users", uid, "cards", card._docId));
      setDeck((prev) => prev.filter((c) => c._docId !== card._docId));
      setSelectedForPlacement((cur) => {
        const curId = (cur as any)?._docId as string | undefined;
        return curId && curId === card._docId ? null : cur;
      });
      setDetailCard((cur) => {
        const curId = (cur as any)?._docId as string | undefined;
        return curId && curId === card._docId ? null : cur;
      });
    } catch (e) {
      console.error(e);
      window.alert("카드 삭제에 실패했습니다. 잠시 후 다시 시도하세요.");
    }
  };

  const handleSlotClick = (ref: StepSlotRef) => {
    if (forkEditOn) {
      toggleForkStep(ref.stepIndex);
      return;
    }
    if (selectedForPlacement) {
      placeCardInSlot(ref, selectedForPlacement);
      return;
    }
    const slot = getSlot(ref);
    if (slot) setDetailCard(slot);
  };

  const handleClearSlot = (ref: StepSlotRef) => {
    setSlot(ref, null);
  };

  const handleClearGrid = () => {
    setSteps(makeDefaultSteps(roomCount));
    setForkEditOn(false);
    setSelectedForPlacement(null);
    setMobilePickerOpen(false);
    setMobilePickerTarget(null);
  };

  const handlePublish = async () => {
    if (!uid) {
      setPublishError("로그인이 필요합니다.");
      return;
    }
    if (dungeonName.trim().length < 2) {
      setPublishError("던전 이름을 먼저 설정하세요.");
      return;
    }
    if (steps.length !== roomCount) {
      setPublishError("레이아웃 데이터가 올바르지 않습니다. (스텝 길이 불일치)");
      return;
    }
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si];
      for (let bi = 0; bi < step.slots.length; bi++) {
        if (!step.slots[bi]) {
          setPublishError(
            step.kind === "FORK"
              ? `빈 슬롯이 있습니다. (#${si + 1}-${bi + 1})`
              : `빈 슬롯이 있습니다. (#${si + 1})`,
          );
          return;
        }
      }
    }

    setIsPublishing(true);
    setPublishError(null);
    try {
      const stripMeta = (c: any) => {
        const { _docId, createdAt, ...rest } = c as Record<string, unknown>;
        return rest as unknown as CardData;
      };

      // Firestore does NOT support nested arrays (array-of-array). Store steps as array-of-objects instead.
      const room_steps_v2: Array<{ rooms: CardData[] }> = steps.map((s) =>
        s.kind === "SINGLE"
          ? { rooms: [stripMeta(s.slots[0]!)] }
          : { rooms: [stripMeta(s.slots[0]!), stripMeta(s.slots[1]!)] },
      );
      const card_list = room_steps_v2.flatMap((s) => s.rooms);

      // Store deterministic links in a Firestore-safe shape (no tuple arrays).
      const indicesByStep: number[][] = [];
      let idx = 0;
      for (const s of steps) {
        if (s.kind === "SINGLE") indicesByStep.push([idx++]);
        else indicesByStep.push([idx, idx + 1]), (idx += 2);
      }
      const room_links_v2: Array<
        | { kind: "END" }
        | { kind: "NEXT"; next: number }
        | { kind: "FORK"; a: number; b: number }
      > = card_list.map(() => ({ kind: "END" }));
      for (let si = 0; si < indicesByStep.length; si++) {
        const nextLink =
          si + 1 >= indicesByStep.length
            ? ({ kind: "END" } as const)
            : indicesByStep[si + 1]!.length === 1
              ? ({ kind: "NEXT", next: indicesByStep[si + 1]![0]! } as const)
              : ({
                  kind: "FORK",
                  a: indicesByStep[si + 1]![0]!,
                  b: indicesByStep[si + 1]![1]!,
                } as const);
        for (const ri of indicesByStep[si]!) room_links_v2[ri] = nextLink;
      }

      const payload = pruneUndefined({
        schema_version: 2,
        creator_uid: uid,
        creator_nickname: nickname ?? "모험가",
        name: dungeonName.trim(),
        description: dungeonDescription.trim(),
        difficulty,
        room_count: roomCount,
        room_total: card_list.length,
        room_steps_v2,
        card_list,
        room_links_v2,
        likes: 0,
        play_count: 0,
        created_at: serverTimestamp(),
      });
      await addDoc(collection(db, "dungeons"), payload);
      setPublishOpen(false);
      router.push("/explore");
    } catch (e) {
      console.error(e);
      setPublishError("게시 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setIsPublishing(false);
    }
  };

  const filledSlots = steps.reduce(
    (acc, s) => acc + s.slots.filter((x) => x !== null).length,
    0,
  );
  const requiredSlots = steps.reduce((acc, s) => acc + s.slots.length, 0);
  const forkCount = steps.reduce((acc, s) => acc + (s.kind === "FORK" ? 1 : 0), 0);
  const canPublish = dungeonName.trim().length >= 2 && filledSlots === requiredSlots;

  return (
    <div className="min-h-screen bg-background overflow-hidden font-sans flex flex-col">
      <header className="h-16 border-b border-gray-800 bg-surface/90 backdrop-blur grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 sm:px-6 sticky top-0 z-40">
        <div className="min-w-0 flex items-center gap-3 justify-self-start">
          <Link
            href="/"
            className="p-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            title="로비로"
          >
            <FaChevronLeft />
          </Link>
          <div className="min-w-0">
            <div className="text-gray-200 font-serif font-bold truncate">
              {dungeonName || "새 던전"}
            </div>
            <div className="text-xs text-gray-600">
              거쳐야 할 방 {roomCount} · 슬롯 {filledSlots} / {requiredSlots}
              {forkCount > 0 ? ` · 갈림길 ${forkCount} (+${forkCount})` : ""} ·{" "}
              {difficulty}
            </div>
          </div>
        </div>

        <AppLogoLink className="justify-self-center" />

        <div className="flex items-center justify-end gap-2 min-w-0">
          <button
            onClick={() => {
              setSetupMode("edit");
              setSetupOpen(true);
            }}
            className="p-2 sm:px-3 sm:py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            title="설정"
          >
            <span className="inline-flex items-center gap-2">
              <FaCog />
              <span className="hidden sm:inline">설정</span>
            </span>
          </button>
          <button
            onClick={() => {
              setForkEditOn((on) => {
                const next = !on;
                if (next) {
                  setSelectedForPlacement(null);
                  setMobilePickerOpen(false);
                  setMobilePickerTarget(null);
                  setMobileView("LAYOUT");
                }
                return next;
              });
            }}
            className={`p-2 sm:px-3 sm:py-2 rounded border transition-colors ${
              forkEditOn
                ? "bg-primary/10 border-primary/50 text-primary hover:bg-primary/15"
                : "border-gray-800 text-gray-400 hover:text-white hover:border-gray-600"
            }`}
            title="갈림길"
          >
            <span className="inline-flex items-center gap-2">
              <FaCodeBranch />
              <span className="hidden sm:inline">갈림길</span>
            </span>
          </button>
          <button
            onClick={handleClearGrid}
            className="p-2 sm:px-3 sm:py-2 rounded border border-gray-800 text-red-400 hover:border-gray-600 hover:bg-red-900/10 transition-colors"
            title="초기화"
          >
            <span className="inline-flex items-center gap-2">
              <FaTrash />
              <span className="hidden sm:inline">초기화</span>
            </span>
          </button>
          <button
            disabled={!canPublish}
            onClick={() => {
              setPublishError(null);
              setPublishOpen(true);
            }}
            className={`p-2 sm:px-3 sm:py-2 rounded transition-colors ${
              canPublish
                ? "bg-primary/10 border border-primary/50 text-primary hover:bg-primary/20"
                : "bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed"
            }`}
            title="게시하기"
          >
            <span className="inline-flex items-center gap-2">
              <FaSave />
              <span className="hidden sm:inline">게시하기</span>
            </span>
          </button>
        </div>
      </header>

      <nav className="lg:hidden border-b border-gray-800 bg-surface/70">
        <div className="grid grid-cols-3">
          <button
            onClick={() => switchMobileView("CHAT")}
            className={`py-3 text-sm border-r border-gray-800 transition-colors ${
              mobileView === "CHAT"
                ? "text-primary bg-black/20"
                : "text-gray-500 hover:text-gray-200"
            }`}
          >
            생성
          </button>
          <button
            onClick={() => switchMobileView("LAYOUT")}
            className={`py-3 text-sm border-r border-gray-800 transition-colors ${
              mobileView === "LAYOUT"
                ? "text-primary bg-black/20"
                : "text-gray-500 hover:text-gray-200"
            }`}
          >
            레이아웃
          </button>
          <button
            onClick={() => switchMobileView("DECK")}
            className={`py-3 text-sm transition-colors ${
              mobileView === "DECK"
                ? "text-primary bg-black/20"
                : "text-gray-500 hover:text-gray-200"
            }`}
          >
            덱
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden">
        {/* Mobile: tabbed views with smooth transitions */}
        <div className="lg:hidden h-full">
          <AnimatePresence mode="wait" initial={false} custom={mobileDir}>
            {mobileView === "CHAT" && (
              <motion.div
                key="CHAT"
                custom={mobileDir}
                initial={{ opacity: 0, x: 28 * mobileDir }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 * mobileDir }}
                transition={{ duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }}
                className="h-full flex flex-col bg-surface"
              >
                <div className="p-4 border-b border-gray-800 bg-surface">
                  <CategorySelector
                    onCategorySelect={handleCategorySelect}
                    selectedCategory={selectedCategory}
                    selectedSubCategory={selectedSubCategory}
                  />
                </div>
                <div className="flex-1 overflow-hidden">
                  <ChatInterface
                    onCardGenerated={handleCardGenerated}
                    selectedCategory={selectedCategory}
                    selectedSubCategory={selectedSubCategory}
                    difficulty={difficulty}
                  />
                </div>
              </motion.div>
            )}

            {mobileView === "LAYOUT" && (
              <motion.div
                key="LAYOUT"
                custom={mobileDir}
                initial={{ opacity: 0, x: 28 * mobileDir }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 * mobileDir }}
                transition={{ duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }}
                className="h-full overflow-y-auto p-4 bg-grid-pattern"
              >
                {forkEditOn && (
                  <div className="sticky top-0 z-30 mb-4 border border-primary/40 bg-black/70 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                        갈림길 편집
                      </div>
                      <div className="text-sm text-gray-200 font-bold truncate">
                        스텝을 눌러 단일/갈림길을 전환합니다
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        갈림길을 만들면 해당 스텝에 방 슬롯이 1개 추가됩니다.
                      </div>
                    </div>
                    <button
                      onClick={() => setForkEditOn(false)}
                      className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300 hover:border-gray-600 transition-colors"
                      title="갈림길 편집 종료"
                    >
                      닫기
                    </button>
                  </div>
                )}

                {selectedForPlacement && (
                  <div className="sticky top-0 z-30 mb-4 border border-primary/40 bg-black/60 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                        배치 모드
                      </div>
                      <div className="text-sm text-gray-200 font-bold truncate">
                        {selectedForPlacement.name}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedForPlacement(null)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded text-gray-300 hover:border-gray-600 transition-colors"
                    >
                      <FaTimes />
                      <span className="hidden sm:inline">해제</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-7xl mx-auto mb-10">
                  {steps.map((step, stepIndex) => {
                    const renderSlot = (slotIndex: 0 | 1, badge?: "1" | "2") => {
                      const card =
                        step.kind === "SINGLE"
                          ? step.slots[0]
                          : step.slots[slotIndex];
                      const ref: StepSlotRef = { stepIndex, slotIndex };
                      const isEmpty = !card;
                      const showHint = Boolean(selectedForPlacement) && isEmpty && !forkEditOn;

                      return (
                        <div
                          key={`${stepIndex}-${slotIndex}`}
                          onClick={() => handleMobileSlotClick(ref)}
                          className={`relative ${
                            isEmpty
                              ? `aspect-[3/4] border-2 border-dashed ${
                                  showHint ? "border-primary/30 slot-hint" : "border-gray-800 hover:border-gray-600"
                                } rounded-lg flex items-center justify-center bg-black/20 transition-all`
                              : "group"
                          }`}
                        >
                          {isEmpty ? (
                            <span className="text-gray-700 font-mono text-[10px]">
                              #{stepIndex + 1}
                            </span>
                          ) : (
                            <div className="relative">
                              <CardMiniTile card={card as CardData} className="w-full" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearSlot(ref);
                                }}
                                className="absolute top-1 right-1 p-1 rounded bg-black/80 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors"
                                aria-label="슬롯 비우기"
                                title="슬롯 비우기"
                              >
                                <FaTimes />
                              </button>
                            </div>
                          )}
                          {badge && (
                            <div className="absolute top-1 left-1 text-[10px] px-2 py-0.5 rounded bg-black/70 border border-gray-800 text-gray-200">
                              {badge}
                            </div>
                          )}
                        </div>
                      );
                    };

                    if (step.kind === "SINGLE") {
                      return (
                        <motion.div
                          key={stepIndex}
                          layout
                          transition={STEP_LAYOUT_TRANSITION}
                          className="relative"
                        >
                          {renderSlot(0)}
                        </motion.div>
                      );
                    }

                    // Fork step: span 2 columns so each choice slot stays readable.
                    return (
                      <motion.div
                        key={stepIndex}
                        layout
                        transition={STEP_LAYOUT_TRANSITION}
                        className="col-span-2 relative"
                      >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-black/70 border border-gray-800 text-primary/90 text-xs flex items-center gap-1">
                          <FaCodeBranch />
                          <span className="font-mono">{stepIndex + 1}</span>
                        </div>
                        <div className="rounded-xl border border-primary/25 bg-black/25 p-2">
                          <div className="grid grid-cols-2 gap-3">
                            {renderSlot(0, "1")}
                            {renderSlot(1, "2")}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {mobilePickerOpen && mobilePickerTarget && (
                    <motion.div
                      key="MOBILE_PICKER"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 bg-black/60"
                      onClick={() => {
                        setMobilePickerOpen(false);
                        setMobilePickerTarget(null);
                      }}
                    >
                      <motion.div
                        initial={{ y: 24, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 24, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }}
                        className="absolute inset-x-0 bottom-0 bg-surface border-t border-gray-800 rounded-t-2xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                              스텝 #{mobilePickerTarget.stepIndex + 1}
                              {steps[mobilePickerTarget.stepIndex]?.kind === "FORK"
                                ? ` · 선택지 ${mobilePickerTarget.slotIndex + 1}`
                                : ""}
                            </div>
                            <div className="text-sm text-gray-200 font-bold">
                              카드 선택
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setMobilePickerOpen(false);
                              setMobilePickerTarget(null);
                            }}
                            className="p-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                            aria-label="닫기"
                          >
                            <FaTimes />
                          </button>
                        </div>

                        <div className="max-h-[55vh] overflow-y-auto p-4 bg-grid-pattern">
                          {deck.length === 0 ? (
                            <div className="text-gray-600 italic text-sm w-full text-center py-12">
                              보유 카드가 없습니다. 먼저 카드를 생성하세요.
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                              {deck.map((card, i) => (
                                <button
                                  key={`${i}-${card.name}`}
                                  onClick={() => {
                                    placeCardInSlot(mobilePickerTarget, card);
                                    setMobilePickerOpen(false);
                                    setMobilePickerTarget(null);
                                  }}
                                  className="rounded-lg border border-gray-800 bg-black/20 hover:border-gray-600 transition-colors"
                                >
                                  <div className="p-2">
                                    <CardMiniTile card={card} className="w-full" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {mobileView === "DECK" && (
              <motion.div
                key="DECK"
                custom={mobileDir}
                initial={{ opacity: 0, x: 28 * mobileDir }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 * mobileDir }}
                transition={{ duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }}
                className="h-full overflow-y-auto p-4 bg-grid-pattern"
              >
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-gray-400 font-serif font-bold">
                      생성된 카드{" "}
                      <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full ml-2">
                        {deck.length}
                      </span>
                    </div>
                    {selectedForPlacement && (
                      <button
                        onClick={() => setSelectedForPlacement(null)}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        선택 해제
                      </button>
                    )}
                  </div>

                  {deck.length === 0 ? (
                    <div className="text-gray-600 italic text-sm w-full text-center py-20">
                      카테고리를 선택하고 채팅으로 카드를 생성하세요.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {deck.map((card, i) => {
                        const selected = selectedForPlacement === card;
                        return (
                          <div
                            key={`${i}-${card.name}`}
                            className={`rounded-lg border transition-colors ${
                              selected
                                ? "border-primary/60 bg-primary/5"
                                : "border-gray-800 bg-black/20"
                            }`}
                          >
                            <div className="p-2">
                              <CardMiniTile card={card} className="w-full" />
                            </div>
                            <div className="px-2 pb-2 flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedForPlacement(card);
                                  setMobilePickerOpen(false);
                                  setMobilePickerTarget(null);
                                  switchMobileView("LAYOUT");
                                }}
                                className="flex-1 px-3 py-2 bg-primary/15 border border-primary/40 rounded text-xs text-primary hover:bg-primary/20 transition-colors"
                              >
                                선택하기
                              </button>
                              <button
                                onClick={() => setDetailCard(card)}
                                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300 hover:border-gray-600 transition-colors"
                              >
                                정보 보기
                              </button>
                              <button
                                onClick={() => handleDeleteOwnedCard(card)}
                                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs text-red-300 hover:border-gray-600 hover:bg-red-900/10 transition-colors"
                                title="삭제"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop: chat + workspace */}
        <div className="hidden lg:flex h-full">
          <div className="w-[400px] flex-shrink-0 relative z-20 shadow-xl flex flex-col border-r border-gray-800 bg-surface">
            <div className="p-4 border-b border-gray-800 bg-surface">
              <CategorySelector
                onCategorySelect={handleCategorySelect}
                selectedCategory={selectedCategory}
                selectedSubCategory={selectedSubCategory}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatInterface
                onCardGenerated={handleCardGenerated}
                selectedCategory={selectedCategory}
                selectedSubCategory={selectedSubCategory}
                difficulty={difficulty}
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 p-6 overflow-y-auto bg-grid-pattern">
              {forkEditOn && (
                <div className="max-w-7xl mx-auto mb-4 border border-primary/40 bg-black/70 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                      갈림길 편집
                    </div>
                    <div className="text-sm text-gray-200 font-bold truncate">
                      스텝을 클릭해서 단일/갈림길을 전환합니다
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      갈림길을 만들면 해당 스텝에 방 슬롯이 1개 추가됩니다.
                    </div>
                  </div>
                  <button
                    onClick={() => setForkEditOn(false)}
                    className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300 hover:border-gray-600 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              )}

              <div className="grid grid-cols-10 gap-3 max-w-7xl mx-auto mb-10">
                {steps.map((step, stepIndex) => {
                  const renderSlot = (slotIndex: 0 | 1, badge?: "1" | "2") => {
                    const card =
                      step.kind === "SINGLE"
                        ? step.slots[0]
                        : step.slots[slotIndex];
                    const ref: StepSlotRef = { stepIndex, slotIndex };
                    const isEmpty = !card;
                    const showHint = Boolean(selectedForPlacement) && isEmpty && !forkEditOn;

                    return (
                      <div
                        key={`${stepIndex}-${slotIndex}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, ref)}
                        onClick={() => handleSlotClick(ref)}
                        className={`relative ${
                          isEmpty
                            ? `aspect-[3/4] border-2 border-dashed ${
                                showHint ? "border-primary/30 slot-hint" : "border-gray-800 hover:border-gray-600"
                              } rounded-lg flex items-center justify-center bg-black/20 transition-all`
                            : "cursor-pointer hover:ring-2 hover:ring-primary/40 rounded-lg"
                        }`}
                      >
                        {isEmpty ? (
                          <span className="text-gray-700 font-mono text-[10px]">
                            #{stepIndex + 1}
                          </span>
                        ) : (
                          <div className="relative">
                            <CardMiniTile card={card as CardData} className="w-full" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearSlot(ref);
                              }}
                              className="absolute top-1 right-1 p-1 rounded bg-black/80 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors"
                              aria-label="슬롯 비우기"
                              title="슬롯 비우기"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        )}
                        {badge && (
                          <div className="absolute top-1 left-1 text-[10px] px-2 py-0.5 rounded bg-black/70 border border-gray-800 text-gray-200">
                            {badge}
                          </div>
                        )}
                      </div>
                    );
                  };

                    if (step.kind === "SINGLE") {
                      return (
                        <motion.div
                          key={stepIndex}
                          layout
                          transition={STEP_LAYOUT_TRANSITION}
                          className="relative"
                        >
                          {renderSlot(0)}
                        </motion.div>
                      );
                    }

                    // Fork step: span 2 columns so each choice slot stays readable.
                    return (
                      <motion.div
                        key={stepIndex}
                        layout
                        transition={STEP_LAYOUT_TRANSITION}
                        className="col-span-2 relative"
                      >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-black/70 border border-gray-800 text-primary/90 text-xs flex items-center gap-1">
                          <FaCodeBranch />
                          <span className="font-mono">{stepIndex + 1}</span>
                        </div>
                        <div className="rounded-xl border border-primary/25 bg-black/25 p-2">
                          <div className="grid grid-cols-2 gap-3">
                            {renderSlot(0, "1")}
                            {renderSlot(1, "2")}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

              <div className="border-t border-gray-800 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-400 font-serif flex items-center gap-2">
                    <span>생성된 카드</span>
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full">
                      {deck.length}
                    </span>
                  </h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 px-2 min-h-[280px] items-start">
                  {deck.length === 0 && (
                    <div className="text-gray-600 italic text-sm w-full text-center py-20">
                      카테고리를 선택하고 채팅으로 카드를 생성하세요.
                    </div>
                  )}
                {deck.map((card, i) => (
                  <div
                    key={`${i}-${card.name}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card)}
                    className="flex-shrink-0 relative group"
                  >
                    <div className="transform group-hover:-translate-y-1 transition-transform">
                      <CardMiniTile card={card} className="w-24" />
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all">
                      <button
                        onClick={() => setDetailCard(card)}
                        className="bg-black/80 px-2 py-2 rounded text-gray-300 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors"
                        title="정보 보기"
                      >
                        <FaInfoCircle />
                      </button>
                      <button
                        onClick={() => handleDeleteOwnedCard(card)}
                        className="bg-black/80 px-2 py-2 rounded text-red-300 hover:text-red-200 border border-gray-800 hover:border-gray-600 transition-colors"
                        title="삭제"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Detail Modal */}
      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />

      <PublishDungeonModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        roomCount={roomCount}
        slotCount={requiredSlots}
        difficulty={difficulty}
        onPublish={handlePublish}
        onEdit={() => {
          setSetupMode("edit");
          setSetupOpen(true);
        }}
        isPublishing={isPublishing}
        error={publishError}
        name={dungeonName}
        description={dungeonDescription}
      />

      <DungeonSetupModal
        open={setupOpen}
        mode={setupMode}
        initial={{
          name: dungeonName,
          description: dungeonDescription,
          roomCount,
          difficulty,
        }}
        onExit={() => {
          if (setupMode === "start") router.replace("/");
          else setSetupOpen(false);
        }}
        onConfirm={(next) => {
          applySetup(next);
        }}
      />
    </div>
  );
}
