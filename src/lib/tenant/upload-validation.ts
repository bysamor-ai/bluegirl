// 純函數，冇任何 import：client／server 都用得，亦方便單元測試。

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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
    return "圖片太大，上限係 10 MB";
  }
  return null;
}
