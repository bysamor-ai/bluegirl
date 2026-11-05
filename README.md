# BLUE GIRL 餐牌生成器

餐廳餐牌生成器 web app（繁體中文・香港），用作測試 **Vercel + Supabase + fal.ai** 部署流程。

- **Next.js 15**（App Router, TypeScript）
- **Tailwind CSS v4**
- **Supabase**：資料庫 + Storage（食物相片）
- **fal.ai**：AI 生成食物圖片（`fal-ai/gpt-image-1/text-to-image`，只經伺服器 route 呼叫）
- 表單：react-hook-form + useFieldArray + zod
- 貨幣：港幣（HKD）格式
- 4 個主題：經典傳統／簡約現代／尊貴深色／大膽促銷（config 喺 [src/lib/themes.ts](src/lib/themes.ts)，可直接修改）
- 4 張 BLUE GIRL 品牌背景底圖（金啤橫向／金啤直向 Light／雙麥釀造橫向／雙麥釀造直向），圖片喺 `public/backgrounds/`，config 喺 [src/lib/backgrounds.ts](src/lib/backgrounds.ts)；揀咗背景後餐牌會轉用品牌版面（深藍字＋安全邊距避開品牌 footer）
- **Gen Image 最終海報**：背景主題下面嘅按鈕，用 fal.ai `openai/gpt-image-2/edit` 以揀選咗嘅品牌背景做底，AI 合成餐廳名、菜式、價錢同已上載嘅菜式相成一張完整海報（route：[/api/t/[token]/generate-poster](src/app/api/t/[token]/generate-poster/route.ts)）

---

## 1. 環境變數

| 變數 | 用途 | 秘密？ |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | 否（公開設計） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key（配合 RLS） | 否（公開設計） |
| `FAL_KEY` | fal.ai API key | **是 — 只限伺服器，切勿用 `NEXT_PUBLIC_` 開頭** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key（多租戶用，繞過 RLS） | **是 — 只限伺服器，切勿用 `NEXT_PUBLIC_` 開頭，切勿提交入 git** |
| `FAL_IMAGE_MODEL`（可選） | 覆寫圖片模型 | 否 |

複製 `.env.example` 做 `.env.local` 再填值。

## 2. Supabase 設定

1. 去 [supabase.com](https://supabase.com) 建立新專案。
2. 開 **SQL Editor**，貼上並執行 [supabase/schema.sql](supabase/schema.sql) 整份檔案。呢個 script 會：
   - 建立 `restaurants`、`menu_items`、`generated_images` 三張表
   - 開啟 RLS，並加上寬鬆嘅測試政策（anon 全權限 — **上正式環境前要收緊**）
   - 建立 `food-images` Storage bucket（公開讀取、anon 可上傳）
3. （可選）執行 [supabase/seed.sql](supabase/seed.sql) 加入示範餐廳「藍妹茶餐廳」。
4. 去 **Project Settings → API** 抄低 `Project URL` 同 `anon public` key，填入環境變數。

### Storage 說明

`food-images` bucket 由 schema.sql 自動建立。如果想手動建立：Dashboard → **Storage → New bucket**，名稱 `food-images`，剔選 **Public bucket**，然後加兩條 policy（public `select`；anon `insert`）。上載由瀏覽器 POST 去 `/api/t/<token>/upload`，再由伺服器用 service role 寫入 bucket（路徑 `<tenant.id>/<uuid>.<ext>`，只收圖片、上限 4 MB），瀏覽器唔再直接用 anon key 上傳。

## 3. fal.ai 設定

1. 去 [fal.ai](https://fal.ai) 註冊，喺 **Keys** 頁面建立 API key。
2. 填入 `FAL_KEY` 環境變數。
3. 圖片生成只會經 [/api/t/[token]/generate-image](src/app/api/t/[token]/generate-image/route.ts) route handler 喺伺服器進行；key 唔會出現喺客戶端 bundle。

## 4. 本機執行

```bash
npm install
cp .env.example .env.local   # 填好三個變數
npm run dev                  # http://localhost:3000
```

冇設定 Supabase 嘅情況下，編輯器同即時預覽照樣可以試玩；首頁會顯示設定提示。

## 5. 部署去 Vercel

1. 將專案 push 上 GitHub（或 GitLab / Bitbucket）：
   ```bash
   git init && git add -A && git commit -m "init"
   git remote add origin <你嘅 repo URL>
   git push -u origin main
   ```
2. 去 [vercel.com/new](https://vercel.com/new) → **Import** 呢個 repo（Framework 會自動偵測到 Next.js，毋須改設定）。
3. 喺 **Environment Variables** 加入：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `FAL_KEY`
4. 撳 **Deploy**。完成後開啟 production URL 測試：
   - 首頁應該列出 seed 記錄（如有執行 seed.sql）
   - 建立新餐牌 → 上載／生成圖片 → 儲存 → 展示頁
5. 之後每次 push 到 `main` 會自動重新部署。

> 注意：`/api/t/[token]/generate-image` 設定咗 `maxDuration = 60`。Hobby plan 嘅 function 時限係 60 秒，足夠 gpt-image-1 生成一張圖。

## 6. 專案結構

```
src/
├── app/
│   ├── page.tsx                 # 首頁：記錄清單（載入舊記錄）
│   ├── editor/page.tsx          # 建立新餐牌
│   ├── editor/[id]/page.tsx     # 編輯現有記錄
│   ├── menu/[id]/page.tsx       # 最終餐牌展示頁（可列印）
│   ├── wall-sticker/page.tsx    # 牆貼報價 + 實景效果圖（見下面第 7 節）
│   └── api/
│       ├── restaurants/…        # 儲存／載入／刪除
│       ├── generate-image/…     # fal.ai 圖片生成（server-only）
│       ├── generate-sticker-design/…  # fal.ai 生成牆貼設計稿（server-only）
│       └── refine-mockup/…      # fal.ai 精修實景效果圖（server-only）
├── components/
│   ├── …                        # MenuForm / MenuItemRow / MenuPreview / EditorShell …
│   └── wall-sticker/            # WallStickerStudio / PhotoMarker / SpecForm / QuoteCard …
└── lib/
    ├── …                        # themes / schemas(zod) / format(HKD) / supabase clients
    └── wall-sticker/            # geometry(homography) / pricing / render(canvas) …
supabase/
├── schema.sql                   # 資料表 + RLS + Storage
└── seed.sql                     # 示範資料
```

## 7. 牆貼報價工具（`/wall-sticker`）

前線同事去到商戶現場用嘅工具：影相 → 框出貼位 → 入闊高 → 即刻有報價同實景效果圖。

| 步驟 | 做咩 |
| --- | --- |
| ① 框出貼位 | 上載店舖相，拖四個綠點框住要貼嘅位置（可拖成斜角）。「保護前景物件」模式可以框起人／柱，貼圖唔會蓋過去。 |
| ② 尺寸同報價 | 入闊高（米／厘米可切換），即時計 `面積 × HK$1,000`，四捨五入到 HK$1。 |
| ③ 設計稿 | AI 生成 BLUE GIRL 風格設計稿，或者上載 design team 出嘅 artwork。 |
| ④ 實景效果圖 | 前端用真正嘅 homography 投影變換即時合成，可下載；亦可撳「AI 精修」交俾 fal.ai 執靚光影。 |

- **報價率**：改 [`src/lib/wall-sticker/pricing.ts`](src/lib/wall-sticker/pricing.ts) 嘅 `RATE_PER_SQM` 一個常數就得。
- **唔使資料庫都用得**：報價同效果圖全部喺瀏覽器計，Supabase 只係用嚟存檔（`wall_sticker_jobs` 表 + `wall-stickers` bucket，已寫入 `schema.sql`）。
- **AI 唔出中文字**：生成 prompt 明確要求唔好出任何文字，避免出錯字；文字應該由 design team 或者前端疊上去。
- **單元測試**：`npm test`（Vitest）覆蓋報價公式同幾何運算（homography、多邊形判斷、雙線性取樣）。

## 多租戶

呢個工具以「租戶」（`public.clients`）區分唔同品牌。每個租戶有獨立 token，用戶經 token 網址進入，睇到自己嘅品牌同記錄。

- Phase 1 migration：[supabase/migrations/2026-11-05-multi-tenant-phase1.sql](supabase/migrations/2026-11-05-multi-tenant-phase1.sql)
  - 純新增，可重複執行：建立 `clients` 表、`restaurants.client_id`、`generate_client_token()`，並將現有記錄歸入 BLUE GIRL 租戶。
  - 本機同 production 共用同一個 Supabase，執行前請先喺 Supabase 撳一次 backup。
  - 執行後輸出兩個租戶嘅 token，請抄低。
- `SUPABASE_SERVICE_ROLE_KEY`：伺服器端讀取租戶資料用，會繞過 RLS，**只可以放喺伺服器環境變數**（`.env.local`、Vercel Environment Variables），切勿加 `NEXT_PUBLIC_` 前綴，亦唔好提交入 git。
- 核實 migration：`select count(*) as total, count(client_id) as assigned from public.restaurants;` 兩個數字應該相等。

## 8. 安全備註（測試設定）

- RLS 政策同 Storage 政策係 **測試用嘅寬鬆設定**（anon 全權限）。上正式環境前請改為只限已驗證用戶。
- `FAL_KEY` 只喺伺服器 route handler 使用；anon key 屬 Supabase 公開金鑰設計。
