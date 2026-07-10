# BLUE GIRL 餐牌生成器

餐廳餐牌生成器 web app（繁體中文・香港），用作測試 **Vercel + Supabase + fal.ai** 部署流程。

- **Next.js 15**（App Router, TypeScript）
- **Tailwind CSS v4**
- **Supabase**：資料庫 + Storage（食物相片）
- **fal.ai**：AI 生成食物圖片（`fal-ai/gpt-image-1/text-to-image`，只經伺服器 route 呼叫）
- 表單：react-hook-form + useFieldArray + zod
- 貨幣：港幣（HKD）格式
- 4 個主題：經典傳統／簡約現代／尊貴深色／大膽促銷（config 喺 [src/lib/themes.ts](src/lib/themes.ts)，可直接修改）

---

## 1. 環境變數

| 變數 | 用途 | 秘密？ |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | 否（公開設計） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key（配合 RLS） | 否（公開設計） |
| `FAL_KEY` | fal.ai API key | **是 — 只限伺服器，切勿用 `NEXT_PUBLIC_` 開頭** |
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

`food-images` bucket 由 schema.sql 自動建立。如果想手動建立：Dashboard → **Storage → New bucket**，名稱 `food-images`，剔選 **Public bucket**，然後加兩條 policy（public `select`；anon `insert`）。上載係由瀏覽器直接用 anon key 進行（Supabase 標準做法，受 storage policy 管控）。

## 3. fal.ai 設定

1. 去 [fal.ai](https://fal.ai) 註冊，喺 **Keys** 頁面建立 API key。
2. 填入 `FAL_KEY` 環境變數。
3. 圖片生成只會經 [/api/generate-image](src/app/api/generate-image/route.ts) route handler 喺伺服器進行；key 唔會出現喺客戶端 bundle。

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

> 注意：`/api/generate-image` 設定咗 `maxDuration = 60`。Hobby plan 嘅 function 時限係 60 秒，足夠 gpt-image-1 生成一張圖。

## 6. 專案結構

```
src/
├── app/
│   ├── page.tsx                 # 首頁：記錄清單（載入舊記錄）
│   ├── editor/page.tsx          # 建立新餐牌
│   ├── editor/[id]/page.tsx     # 編輯現有記錄
│   ├── menu/[id]/page.tsx       # 最終餐牌展示頁（可列印）
│   └── api/
│       ├── restaurants/…        # 儲存／載入／刪除
│       └── generate-image/…     # fal.ai 圖片生成（server-only）
├── components/                  # MenuForm / MenuItemRow / MenuPreview / EditorShell …
└── lib/                         # themes / schemas(zod) / format(HKD) / supabase clients
supabase/
├── schema.sql                   # 資料表 + RLS + Storage
└── seed.sql                     # 示範資料
```

## 7. 安全備註（測試設定）

- RLS 政策同 Storage 政策係 **測試用嘅寬鬆設定**（anon 全權限）。上正式環境前請改為只限已驗證用戶。
- `FAL_KEY` 只喺伺服器 route handler 使用；anon key 屬 Supabase 公開金鑰設計。
