/**
 * 判斷一個圖片 URL 可唔可以交畀 next/image 優化（經 Vercel CDN 快取）。
 *
 * 必須同 next.config.ts 嘅 images.remotePatterns 保持一致：next/image 遇到
 * 白名單以外嘅 host 會直接 throw，所以未必可優化嘅 URL（data:、blob:、任意外部 host）
 * 一律退回原生 <img>。
 */
const SUPABASE_PUBLIC_PATH = "/storage/v1/object/public/";

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    "[image-host] NEXT_PUBLIC_SUPABASE_URL 未設定或格式錯誤：Supabase 圖片會退回原生 <img>，" +
      "冇經 Vercel CDN，egress 唔會減少。",
  );
}

function supabaseHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    if (raw) return new URL(raw).hostname;
  } catch {
    // 落到下面 warn
  }
  warnOnce();
  return null;
}

/** 只供測試：重設 warn 一次嘅旗標 */
export function __resetWarnedForTests() {
  warned = false;
}

export function canOptimizeImage(src: string): boolean {
  // 本地 public/ 資源
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  let u: URL;
  try {
    u = new URL(src);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false; // data: / blob: / http:
  if (u.hostname === "fal.media" || u.hostname.endsWith(".fal.media")) return true;
  const sb = supabaseHost();
  return !!sb && u.hostname === sb && u.pathname.startsWith(SUPABASE_PUBLIC_PATH);
}
