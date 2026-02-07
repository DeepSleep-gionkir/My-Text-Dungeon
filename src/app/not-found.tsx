import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-text-main px-4 py-12">
      <div className="max-w-xl mx-auto panel-surface p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold">찾을 수 없는 페이지입니다</h1>
        <p className="text-sm text-gray-400">
          요청한 경로가 없거나 접근 권한이 없습니다.
        </p>
        <div>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            로비로 이동
          </Link>
        </div>
      </div>
    </main>
  );
}
