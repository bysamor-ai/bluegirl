# BLUE GIRL 牆貼報價 + In-situ Mockup 工具（設計）

日期：2026-09-09
狀態：已獲用戶批准，實作中（**只限本機，未經批准唔好 push / deploy**）

## 1. 目標

Blue Girl 前線同事去到商戶（餐廳）現場，用手機／電腦：

1. 上載店舖相片，框出想貼牆貼嘅位置
2. 輸入牆貼實際闊、高
3. 即時得到 **生產報價**（HK$1,000 / m²，四捨五入到最接近嘅 HK$1）
4. 即時睇到 **貼落現場嘅 mockup**，可以即場俾商戶睇效果

## 2. 決定（已確認）

| 項目 | 決定 |
| --- | --- |
| 交付形式 | **擴充現有 `blue-girl-menu` 專案**，加新路由 `/wall-sticker`，共用 Supabase / `FAL_KEY` / Tailwind |
| Mockup | 前端即時 homography 透視合成（0 秒、可拖四角調整）＋ 一鍵送 fal.ai 精修光影 |
| 設計稿 | AI 生成 Blue Girl 風格底圖 ＋ 允許上載現成 artwork；中文字由前端疊字，唔靠 AI 出字 |
| 報價 | 淨係 `area × 1000`，四捨五入；無最低消費 / waste / 安裝費 |
| 部署 | **唔 push、唔 deploy**，本機驗證為止 |

## 3. 架構

### 新增檔案

```
src/app/wall-sticker/page.tsx                  主工作頁
src/components/wall-sticker/
  WallStickerStudio.tsx                        client 主容器（狀態機）
  PhotoMarker.tsx                              上載相 + 拖四角 + 前景遮擋多邊形
  SpecForm.tsx                                 闊 / 高輸入（cm ↔ m）
  QuoteCard.tsx                                面積 + 報價
  DesignPicker.tsx                             AI 生成 / 上載 artwork
  MockupCanvas.tsx                             canvas 合成 + 下載
src/lib/wall-sticker/
  geometry.ts                                  homography / pointInPolygon / bilinear（純函數）
  pricing.ts                                   報價公式（純函數）
  render.ts                                    warpDesignIntoQuad（用到 canvas）
  types.ts
src/app/api/generate-sticker-design/route.ts   fal.ai 出設計稿
src/app/api/refine-mockup/route.ts             fal.ai 精修 in-situ 效果
```

`geometry.ts` 同 `render.ts` 由 `~/Downloads/wallstickerestimatordemo.html` 移植（該 demo 已有可用嘅
per-pixel projective warp + 遮擋保護 + 邊緣陰影）。

### 唔做（v1 範圍外）

- MediaPipe 自動人物偵測（demo 有，但要載 CDN 模型、對店舖相唔可靠）→ 改為人手框選遮擋區
- 多張牆貼 / 多個報價項目
- 登入 / 權限

## 4. 資料流

```
上載相 ──> 框選四角（+ 可選遮擋多邊形）──┐
輸入闊高 ──> pricing.ts ──> 報價         ├──> MockupCanvas 即時合成
設計稿（AI 生成 或 上載）────────────────┘
                                          └──> （可選）fal.ai 精修 ──> 存 Supabase / 下載
```

所有座標以 **0–1 正規化** 儲存，唔受顯示尺寸影響。

## 5. 報價規則

```ts
area  = widthM * heightM              // m²
price = Math.round(area * 1000)       // HKD，四捨五入到 $1
```

`RATE_PER_SQM = 1000` 抽做常數，日後改 rate 只改一處。負數 / NaN 輸入一律當 0。

## 6. 資料庫

`supabase/schema.sql` 尾段新增：

- `wall_sticker_jobs` 表：`id, merchant_name, photo_url, design_url, mockup_url,
  width_m, height_m, area_sqm, price_hkd, quad jsonb, obstructions jsonb, created_at`
- `wall-stickers` storage bucket（公開讀、anon 上載），沿用現有寬鬆測試 RLS 政策

**未跑 SQL 都用得**：報價同 mockup 全部喺前端計，Supabase 只係用嚟存檔。

## 7. 錯誤處理

| 情況 | 處理 |
| --- | --- |
| 未上載相 | 顯示引導畫面，唔畀去下一步 |
| 闊或高 ≤ 0 | 報價顯示 HK$0，mockup 照出（尺寸只影響價錢） |
| 四角退化（面積近 0 / 自相交） | 跳過 warp，提示「請重新框選貼位」 |
| 未設定 `FAL_KEY` | AI 按鈕停用並說明；前端 mockup 唔受影響 |
| fal.ai 逾時或失敗 | 保留前端 mockup，顯示錯誤訊息，可重試 |
| Supabase 未設定 | 存檔失敗只提示，唔阻礙報價同 mockup |

## 8. 測試

先寫測試（純函數）：

- `pricing.test.ts` — 單位換算、四捨五入邊界（.5 向上）、0 / 負數 / NaN
- `geometry.test.ts` — homography 正解／反解對應四角、退化四邊形回傳 null、
  `pointInPolygon` 凹多邊形與邊界、`bilinearSample` 邊界夾取

Runner：Vitest（新增 devDependency，本機用）。

UI 部分：喺本機 `npm run dev` 用瀏覽器實測，截圖驗證報價數字同 mockup 效果。
