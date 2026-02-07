"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Component } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string | null;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error("AppErrorBoundary", { error, errorInfo });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-text-main px-4 py-10">
        <div className="max-w-xl mx-auto panel-surface p-6 space-y-4">
          <h1 className="text-xl font-bold text-gray-100">예상치 못한 오류가 발생했습니다</h1>
          <p className="text-sm text-gray-400">
            화면을 복구하는 과정에서 문제가 발생했습니다. 아래 버튼으로 안전하게 이동하세요.
          </p>
          {this.state.message && (
            <pre className="text-xs text-red-300 bg-black/40 border border-red-900/40 rounded p-3 overflow-auto">
              {this.state.message}
            </pre>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              페이지 새로고침
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded border border-gray-700 text-gray-200 hover:border-gray-500 transition-colors"
            >
              로비로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
