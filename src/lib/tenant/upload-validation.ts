// 純函數，冇任何 import：client／server 都用得，亦方便單元測試。

// Vercel serverless function 嘅 request body 硬上限係 4.5MB，超過會喺平台邊緣直接 413，
// handler 根本入唔到，所以上限要喺 4.5MB 之下（連 multipart 開銷）。
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** 訊息由常數衍生，改上限唔使再逐處改字 */
export const UPLOAD_TOO_LARGE_MESSAGE = `圖片太大，上限係 ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`;

/** 回錯誤訊息（可直接俾使用者睇），`null` 代表通過 */
export function validateUpload(file: { type: string; size: number }): string | null {
  // SVG 屬 image/* 但可以夾帶 script，由公開 bucket 直接打開會執行，所以明確拒絕。
  if (!/^image\/[a-z0-9][a-z0-9.+-]*$/i.test(file.type) || /^image\/svg/i.test(file.type)) {
    return "只接受圖片檔案（JPG、PNG、WebP 等）";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "檔案係空嘅，請重新揀選";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return UPLOAD_TOO_LARGE_MESSAGE;
  }
  return null;
}
