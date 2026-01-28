"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUserStore } from "@/store/useUserStore";
import { FaGoogle, FaDungeon } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";
import { GiTorch } from "react-icons/gi";

function playGateSfx() {
  if (typeof window === "undefined") return;
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const ctx = new AudioContextCtor();
  const t0 = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
  master.connect(ctx.destination);

  const creak = ctx.createOscillator();
  creak.type = "sawtooth";
  creak.frequency.setValueAtTime(120, t0);
  creak.frequency.exponentialRampToValueAtTime(52, t0 + 1.25);

  const creakFilter = ctx.createBiquadFilter();
  creakFilter.type = "lowpass";
  creakFilter.frequency.setValueAtTime(900, t0);
  creakFilter.frequency.exponentialRampToValueAtTime(320, t0 + 1.25);
  creak.connect(creakFilter);

  const creakGain = ctx.createGain();
  creakGain.gain.setValueAtTime(0.0001, t0);
  creakGain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.04);
  creakGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
  creakFilter.connect(creakGain);
  creakGain.connect(master);

  const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(1200, t0);
  noiseFilter.Q.setValueAtTime(0.7, t0);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t0);
  noiseGain.gain.exponentialRampToValueAtTime(0.06, t0 + 0.03);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);

  const thunk = ctx.createOscillator();
  thunk.type = "sine";
  thunk.frequency.setValueAtTime(44, t0 + 1.1);
  const thunkGain = ctx.createGain();
  thunkGain.gain.setValueAtTime(0.0001, t0 + 1.05);
  thunkGain.gain.exponentialRampToValueAtTime(0.5, t0 + 1.12);
  thunkGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
  thunk.connect(thunkGain);
  thunkGain.connect(master);

  creak.start(t0);
  creak.stop(t0 + 1.7);
  noise.start(t0);
  noise.stop(t0 + 1.7);
  thunk.start(t0 + 1.05);
  thunk.stop(t0 + 1.35);

  window.setTimeout(() => {
    ctx.close().catch(() => {});
  }, 2200);
}

export default function LoginClient() {
  const router = useRouter();
  const authReady = useUserStore((s) => s.authReady);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEntering, setIsEntering] = useState(false);

  // If Firebase auth is already alive but the user landed on /login,
  // wait until the server session cookie exists before redirecting.
  useEffect(() => {
    if (!authReady || !isAuthenticated || isEntering) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries++;
      const ok = await fetch("/api/me")
        .then((r) => r.ok)
        .catch(() => false);
      if (cancelled) return;
      if (ok) {
        router.replace("/");
        return;
      }
      if (tries < 6) window.setTimeout(tick, 280);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, isEntering, router]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("NO_ID_TOKEN");
      const sessionRes = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) {
        const msg = await sessionRes
          .json()
          .then((d: unknown) =>
            typeof d === "object" && d !== null && "error" in d
              ? String((d as { error?: unknown }).error ?? "")
              : "",
          )
          .catch(() => "");
        throw new Error(msg || "SESSION_FAILED");
      }

      setIsEntering(true);
      playGateSfx();

      // Let the entry animation play first.
      window.setTimeout(() => {
        router.replace("/");
      }, 1400);
    } catch (err: unknown) {
      console.error(err);
      setError("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dungeon-wall text-text-main relative overflow-hidden dungeon-vignette flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-25 bg-noise pointer-events-none" />

      {/* Torches */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden md:block pointer-events-none">
        <div className="relative w-16 h-40">
          <div className="absolute -inset-12 torch-glow" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[44px] text-primary drop-shadow-[0_0_18px_rgba(255,215,0,0.25)]">
            <GiTorch />
          </div>
        </div>
      </div>
      <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:block pointer-events-none">
        <div className="relative w-16 h-40">
          <div className="absolute -inset-12 torch-glow" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[44px] text-primary drop-shadow-[0_0_18px_rgba(255,215,0,0.25)]">
            <GiTorch />
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 w-full max-w-md px-6 py-9 md:px-10 border border-gray-800 bg-surface/80 rounded-lg shadow-2xl backdrop-blur-sm"
      >
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-2">
          <FaDungeon className="text-6xl text-gray-400 mb-4" />
          <h1 className="font-display text-4xl md:text-5xl font-bold text-primary text-center tracking-wide">
            my text dungeon
          </h1>
          <p className="text-gray-500 font-serif text-sm tracking-widest uppercase">enter</p>
        </div>

        {/* Login Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogin}
          disabled={isLoading || isEntering}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gray-950/70 border border-gray-700 hover:border-gray-500 hover:bg-gray-900/70 transition-all duration-300 rounded text-gray-200 group disabled:opacity-60"
        >
          {isLoading ? (
            <span className="font-serif">입장 중...</span>
          ) : (
            <>
              <FaGoogle className="text-xl group-hover:text-white transition-colors" />
              <span className="font-serif">Google로 입장</span>
            </>
          )}
        </motion.button>

        {error && <div className="text-red-500 text-sm text-center font-mono">{error}</div>}

        <div className="text-xs text-gray-600 text-center mt-4">
          입장하는 순간, 당신은 던전의 법칙에 동의한 것입니다.
        </div>
      </motion.div>

      {/* Entry animation overlay */}
      <AnimatePresence>
        {isEntering && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black" />
            <div className="absolute inset-0 flex" style={{ perspective: 1200 }}>
              <motion.div
                className="w-1/2 bg-gate-panel border-r border-black/60"
                style={{ transformOrigin: "left center" }}
                initial={{ rotateY: 0, x: 0 }}
                animate={{ rotateY: -72, x: "-18%" }}
                transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className="w-1/2 bg-gate-panel border-l border-black/60"
                style={{ transformOrigin: "right center" }}
                initial={{ rotateY: 0, x: 0 }}
                animate={{ rotateY: 72, x: "18%" }}
                transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" />
              <div className="absolute inset-0 torch-glow opacity-40" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

