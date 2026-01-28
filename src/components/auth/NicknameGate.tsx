"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useUserStore } from "@/store/useUserStore";
import { FaPenNib, FaSignOutAlt } from "react-icons/fa";

function containsEmoji(input: string) {
  try {
    // Extended_Pictographic covers most emoji glyphs.
    return /\p{Extended_Pictographic}/u.test(input);
  } catch {
    // If unicode properties aren't supported for some reason, skip the check.
    return false;
  }
}

function validateNickname(raw: string) {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false as const, error: "닉네임은 2글자 이상이어야 합니다." };
  if (name.length > 12) return { ok: false as const, error: "닉네임은 12글자 이하로 설정해주세요." };
  if (name.includes("\n")) return { ok: false as const, error: "줄바꿈은 사용할 수 없습니다." };
  if (containsEmoji(name)) return { ok: false as const, error: "이모지는 사용할 수 없습니다." };
  return { ok: true as const, value: name };
}

export default function NicknameGate() {
  const router = useRouter();
  const pathname = usePathname();
  const uid = useUserStore((s) => s.uid);
  const nickname = useUserStore((s) => s.nickname);
  const needsNickname = useUserStore((s) => s.needsNickname);
  const authReady = useUserStore((s) => s.authReady);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const setNickname = useUserStore((s) => s.setNickname);
  const setNeedsNickname = useUserStore((s) => s.setNeedsNickname);

  const open =
    authReady &&
    isAuthenticated &&
    needsNickname &&
    Boolean(uid) &&
    pathname !== "/login";
  const initialValue = useMemo(() => nickname ?? "", [nickname]);

  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValue(initialValue);
  }, [open, initialValue]);

  const handleSave = async () => {
    if (!uid) return;
    if (saving) return;
    const v = validateNickname(value);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, "users", uid), {
        nickname: v.value,
        nickname_set: true,
        nicknameUpdatedAt: serverTimestamp(),
      });
      setNickname(v.value);
      setNeedsNickname(false);
    } catch (e) {
      console.error(e);
      setError("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await fetch("/api/logout", { method: "POST" }).catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      useUserStore.getState().logout();
      setNeedsNickname(false);
      router.replace("/login");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70" />
          <motion.div
            className="relative w-full max-w-md border border-gray-800 bg-surface/95 rounded-lg p-6 shadow-2xl"
            initial={{ y: 10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center gap-2 text-gray-200 font-bold text-lg">
              <FaPenNib className="text-primary" />
              <span>닉네임 설정</span>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              첫 로그인입니다. 닉네임을 설정해야 게임을 시작할 수 있습니다.
            </div>

            <div className="mt-5">
              <label className="text-xs text-gray-600">닉네임 (2~12자)</label>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="예: 은빛모험가"
                className="mt-2 w-full bg-gray-900 border border-gray-800 rounded-md py-3 px-3 text-gray-200 focus:outline-none focus:border-primary transition-colors"
                disabled={saving}
                maxLength={24}
              />
              {error && (
                <div className="mt-3 text-sm rounded border border-red-900 bg-red-900/10 text-red-300 px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary/20 border border-primary/50 rounded text-primary hover:bg-primary/30 transition-colors disabled:opacity-60"
              >
                <FaPenNib />
                <span>{saving ? "저장 중..." : "저장"}</span>
              </button>
              <button
                onClick={handleLogout}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded text-gray-200 hover:border-gray-600 transition-colors disabled:opacity-60"
              >
                <FaSignOutAlt />
                <span>로그아웃</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
