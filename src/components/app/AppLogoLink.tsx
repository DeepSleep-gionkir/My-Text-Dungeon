"use client";

import Link from "next/link";
import { GiTorch } from "react-icons/gi";

export default function AppLogoLink({
  className = "",
  title = "홈으로",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <Link
      href="/"
      title={title}
      aria-label={title}
      className={`group relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-black/20 text-gray-200 hover:text-white hover:border-gray-600 hover:bg-black/30 hover:shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition-colors overflow-hidden cursor-pointer active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <span className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
        <span className="absolute -inset-y-6 -left-1/2 w-[160%] bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-12 translate-x-[-30%] group-hover:translate-x-[30%] transition-transform duration-700 ease-out" />
      </span>
      <GiTorch className="text-primary" aria-hidden />
      <span className="hidden sm:inline font-display tracking-wide text-sm sm:text-base">
        my text dungeon
      </span>
    </Link>
  );
}
