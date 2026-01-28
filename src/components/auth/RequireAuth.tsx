"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background text-text-main flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="border border-gray-800 bg-surface/60 rounded-lg p-6">
          <div className="font-display text-xl text-gray-200">
            준비 중입니다
          </div>
          <div className="mt-2 text-sm text-gray-500">
            연결을 확인하고 있습니다.
          </div>
          <div className="mt-4 h-1.5 w-full bg-black/40 rounded">
            <div className="h-1.5 w-1/2 bg-primary/60 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const authReady = useUserStore((s) => s.authReady);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (authReady && !isAuthenticated) router.replace("/login");
  }, [authReady, isAuthenticated, router]);

  if (!authReady) return <LoadingScreen />;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
