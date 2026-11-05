/**
 * 租戶 URL schema —— **唯一**一份定義。
 *
 * 呢個檔案刻意保持純字串、零 import（尤其係冇 `server-only`），
 * 所以 server component、client component、route handler 都用得。
 * 改 URL 結構淨係改呢度，唔會出現「改咗兩處漏咗第三處」嘅靜靜 404。
 */

/** 租戶頁面嘅連結前綴，例如 `/t/abc123DEF456` */
export function tenantBasePath(token: string): string {
  return `/t/${encodeURIComponent(token)}`;
}

/** 餐牌展示頁 `/t/<token>/menu/<id>` */
export function tenantMenuPath(token: string, restaurantId: string): string {
  return `${tenantBasePath(token)}/menu/${restaurantId}`;
}

/** 編輯現有餐牌 `/t/<token>/editor/<id>` */
export function tenantEditorPath(token: string, restaurantId: string): string {
  return `${tenantBasePath(token)}/editor/${restaurantId}`;
}

/** 建立新餐牌 `/t/<token>/editor` */
export function tenantNewEditorPath(token: string): string {
  return `${tenantBasePath(token)}/editor`;
}

/** 牆貼報價 `/t/<token>/wall-sticker` */
export function tenantWallStickerPath(token: string): string {
  return `${tenantBasePath(token)}/wall-sticker`;
}
