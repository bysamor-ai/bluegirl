// 客戶端上傳前縮圖。純函數部分（shouldResize／computeTargetSize／resizedFileName）有單元測試；
// prepareImageForUpload 依賴瀏覽器 canvas，唔喺 vitest 測。
// 呢個係方便功能，唔係信任邊界：server 仍然會用 validateUpload 重新驗證。
import { MAX_UPLOAD_BYTES } from "./tenant/upload-validation";

export const MAX_LONG_EDGE = 2000;
const JPEG_QUALITIES = [0.85, 0.7, 0.55];

// 瀏覽器 canvas 一般解得到、而且重新編碼成 JPEG 合理嘅格式。
// GIF 排除（會令動畫變靜止）。
const RESIZABLE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

/** 淨係超過上限先縮：細過上限嘅（包括 PNG）原檔上傳，避免無謂劣化同失去透明度 */
export function shouldResize(file: { type: string; size: number }): boolean {
  return (
    RESIZABLE_TYPES.has(file.type.toLowerCase()) &&
    file.size > MAX_UPLOAD_BYTES
  );
}

/** 長邊縮到 maxEdge，保持比例，唔放大；尺寸無效回 null */
export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number = MAX_LONG_EDGE
): { width: number; height: number } | null {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) return null;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function resizedFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "photo"}.jpg`;
}

async function decode(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      // 按 EXIF 轉返正（唔支援呢個 option 嘅舊瀏覽器會拋錯，落去 fallback）
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      /* fall through */
    }
  }
  // Fallback：<img>。現代瀏覽器預設會按 EXIF 方向顯示並畫上 canvas。
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/**
 * 需要時將相片縮細（長邊 2000px、JPEG）。
 * 任何一步失敗（解唔到格式、canvas 唔支援等）都回傳原檔，由 server 驗證決定接唔接受。
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!shouldResize(file)) return file;

  let decoded: Awaited<ReturnType<typeof decode>> | null = null;
  try {
    decoded = await decode(file);
    const target = computeTargetSize(decoded.width, decoded.height);
    if (!target) return file;

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // JPEG 冇透明度，先鋪白底，否則透明位會變黑
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(decoded.source, 0, 0, target.width, target.height);

    let blob: Blob | null = null;
    for (const quality of JPEG_QUALITIES) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    }
    // 編碼失敗或者反而更大，用原檔
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], resizedFileName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    decoded?.release();
  }
}
