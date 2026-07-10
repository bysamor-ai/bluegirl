import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 測試用途：容許 Supabase Storage 同 fal.media 圖片
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.fal.media" },
      { protocol: "https", hostname: "fal.media" },
    ],
  },
};

export default nextConfig;
