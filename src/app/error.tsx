"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background text-text-main px-4 py-10">
        <div className="max-w-xl mx-auto panel-surface p-6 space-y-4">
          <h1 className="text-xl font-bold">오류가 발생했습니다</h1>
          <p className="text-sm text-gray-400">
            잠시 후 다시 시도하거나 로비로 이동하세요.
          </p>
          <pre className="text-xs text-red-300 bg-black/40 border border-red-900/40 rounded p-3 overflow-auto">
            {error.message}
          </pre>
          <div className="flex items-center gap-2">
            <button
              onClick={() => reset()}
              className="px-4 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              다시 시도
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded border border-gray-700 text-gray-200 hover:border-gray-500 transition-colors"
            >
              로비로 이동
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
