import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout 保持中性：頁首／導覽已經搬咗去 `src/app/t/[token]/layout.tsx`，
 * 因為導覽連結要帶 token。品牌白牌化（租戶 logo／主色／標題）係 Task 7 嘅範圍。
 */
export const metadata: Metadata = {
  title: "餐牌生成器",
  description: "餐廳餐牌生成器",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-HK">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
