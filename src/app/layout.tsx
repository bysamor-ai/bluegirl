import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLUE GIRL 餐牌生成器",
  description: "餐廳餐牌生成器 — 測試部署用（Vercel + Supabase + fal.ai）",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-HK">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                BG
              </span>
              {/* 手機淨顯示品牌名，避免同導覽逼到換行 */}
              <span className="truncate text-base font-semibold tracking-tight sm:text-lg">
                BLUE GIRL
                <span className="hidden sm:inline"> 餐牌生成器</span>
              </span>
            </Link>
            <nav className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
              <Link
                href="/"
                className="whitespace-nowrap text-slate-600 hover:text-slate-900"
              >
                記錄
              </Link>
              <Link
                href="/wall-sticker"
                className="whitespace-nowrap text-slate-600 hover:text-slate-900"
              >
                牆貼報價
              </Link>
              <Link
                href="/editor"
                className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
              >
                <span className="hidden sm:inline">建立</span>新餐牌
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
