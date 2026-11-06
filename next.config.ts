import type { NextConfig } from "next";

// Supabase Storage host 由 NEXT_PUBLIC_SUPABASE_URL 取；build 時未設定就退回 *.supabase.co
function supabaseHostname(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "**.supabase.co";
  }
}

const nextConfig: NextConfig = {
  images: {
    // 目標：Supabase 只送一次原圖畀 Vercel，之後由 Vercel CDN 食。
    // 改動時請同步 src/lib/image-host.ts（白名單以外嘅 host 會令 next/image throw）。
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname(),
        pathname: "/storage/v1/object/public/**",
      },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "**.fal.media" },
    ],
    // 優化後圖片喺 CDN 快取一年（原圖 URL 為隨機 UUID，內容不變）
    minimumCacheTTL: 31536000,
  },
};

export default nextConfig;
