# BLUE GIRL 餐牌生成器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個 zh-HK 餐廳餐牌生成器 web app（Next.js 15 + Supabase + fal.ai），可於 Vercel 部署，用作測試用途。

**Architecture:** App Router 專案，客戶端表單（react-hook-form + useFieldArray + zod）即時驅動預覽元件；所有外部 API（fal.ai）經 server route handler 呼叫，秘密只存於伺服器環境變數；Supabase 負責資料庫（restaurants / menu_items / generated_images，RLS 開啟但政策寬鬆）同 Storage（food-images bucket，客戶端以 anon key 直接上傳 — anon key 屬公開設計，非秘密）。

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS v4, @supabase/supabase-js, react-hook-form + @hookform/resolvers + zod, @fal-ai/client（模型：`fal-ai/gpt-image-1/text-to-image`）。

---

## File Structure

```
blue-girl-menu/
├── README.md
├── .env.example                      # 環境變數清單（不含真值）
├── .gitignore
├── package.json / tsconfig.json / next.config.ts / postcss.config.mjs
├── docs/plans/2026-07-10-blue-girl-menu.md
├── supabase/
│   ├── schema.sql                    # 資料表 + RLS + storage bucket/policies
│   └── seed.sql                      # 示範資料
└── src/
    ├── app/
    │   ├── layout.tsx                # zh-HK <html lang="zh-HK">
    │   ├── globals.css               # Tailwind v4 entry
    │   ├── page.tsx                  # 首頁：載入舊記錄清單 + 建立新餐牌
    │   ├── editor/
    │   │   ├── page.tsx              # 新餐牌編輯器
    │   │   └── [id]/page.tsx         # 載入現有記錄編輯
    │   ├── menu/[id]/page.tsx        # 最終餐牌展示頁（server component）
    │   └── api/
    │       ├── restaurants/route.ts          # GET 清單 / POST 儲存
    │       ├── restaurants/[id]/route.ts     # GET 單筆（含 items）/ DELETE
    │       └── generate-image/route.ts       # fal.ai 圖片生成（server-only）
    ├── components/
    │   ├── MenuForm.tsx              # 表單（useFieldArray：新增/移除/排序）
    │   ├── MenuItemRow.tsx           # 單個菜式列（相片上載/生成/欄位）
    │   ├── MenuPreview.tsx           # 即時預覽，按主題切換版面
    │   └── EditorShell.tsx           # 編輯器版面：表單 + 預覽並排（手機直向）
    └── lib/
        ├── themes.ts                 # 4 個主題 structured config
        ├── schemas.ts                # zod schemas（前後端共用）
        ├── format.ts                 # HKD 貨幣格式
        ├── types.ts                  # DB row types
        └── supabase/
            ├── client.ts             # browser client（anon key）
            └── server.ts             # server client（route handlers 用）
```

## 決策記錄

- **fal.ai endpoint**：`fal-ai/gpt-image-1/text-to-image`（已於 fal.ai API 文件核實；輸入 `prompt`/`image_size`/`quality`，輸出 `images[].url`）。可經 `FAL_IMAGE_MODEL` 環境變數覆寫。
- **秘密**：`FAL_KEY` 只在 server route 使用；`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 屬 Supabase 公開金鑰設計，配合 RLS 使用。
- **排序**：上移/下移按鈕（最簡單穩定，不加 dnd 套件）。
- **儲存流程**：POST /api/restaurants 以 zod 驗證後，upsert restaurant 再整批重寫 menu_items（測試用途，簡單可靠）。
- **上載**：客戶端直接上傳去 Supabase Storage `food-images` bucket（公開讀取；anon 可寫 — 測試設定）。
- **生成圖片**：儲存 fal.media URL 及 metadata 到 `generated_images`，同時填入表單項目 image_url。

## Tasks

### Task 1: 專案骨架
**Files:** Create `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`
- [ ] 手寫 scaffold（Next 15 + React 19 + Tailwind v4 + TS），`npm install`
- [ ] `npm run build` 通過（以 placeholder env）
- [ ] git init + commit

### Task 2: lib 層
**Files:** Create `src/lib/{themes,schemas,format,types}.ts`, `src/lib/supabase/{client,server}.ts`
- [ ] 4 主題 config（classic / minimal / dark / promo）：名稱、色彩、字體、版面 class
- [ ] zod：restaurantSchema（name 1-100、theme enum、items 1-30：name/price>=0/image_url optional/sort_order）
- [ ] `formatHKD(price)` 用 `Intl.NumberFormat('zh-HK',{currency:'HKD'})`
- [ ] commit

### Task 3: Supabase SQL
**Files:** Create `supabase/schema.sql`, `supabase/seed.sql`
- [ ] 三張表（uuid pk、fk cascade）、RLS enable + anon 全權限 policy（測試用）、`food-images` bucket + storage policies
- [ ] seed：1 間示範餐廳 + 3 個菜式
- [ ] commit

### Task 4: API routes
**Files:** Create `src/app/api/restaurants/route.ts`, `src/app/api/restaurants/[id]/route.ts`, `src/app/api/generate-image/route.ts`
- [ ] restaurants GET/POST（zod 驗證、錯誤回 400/500 連 zh-HK 訊息）
- [ ] [id] GET（restaurant + items 順 sort_order）/ DELETE
- [ ] generate-image POST：驗證 body（restaurantId?、menuItemId?、foodName）、砌 prompt、`fal.subscribe`、寫入 generated_images（best-effort）、回 `{ imageUrl, prompt }`
- [ ] commit

### Task 5: 表單 + 即時預覽
**Files:** Create `src/components/{MenuForm,MenuItemRow,MenuPreview,EditorShell}.tsx`, `src/app/editor/page.tsx`, `src/app/editor/[id]/page.tsx`
- [ ] MenuForm：rhf + zodResolver + useFieldArray（append/remove/swap 上落移）
- [ ] MenuItemRow：相片上載（客戶端 → storage）、「生成圖片」按鈕（缺圖時 call /api/generate-image）、loading/error 狀態
- [ ] MenuPreview：`watch()` 即時更新，按 theme config 切換版面；空狀態顯示提示
- [ ] 儲存按鈕：optimistic 轉跳 + pending 狀態；載入模式由 [id] page 拉資料入 defaultValues
- [ ] commit

### Task 6: 首頁 + 展示頁
**Files:** Create `src/app/page.tsx`, `src/app/menu/[id]/page.tsx`
- [ ] 首頁：記錄清單（名稱/主題/日期、編輯/展示/刪除）、空狀態、錯誤狀態（env 未設定時提示）
- [ ] /menu/[id]：server component，按主題渲染適合餐廳展示嘅整版餐牌
- [ ] commit

### Task 7: README + 驗證
**Files:** Create `README.md`
- [ ] README：setup、env 清單、Supabase storage 設定步驟、Vercel 部署步驟、seed 方法
- [ ] `npm run build` 通過；dev server 以 placeholder env 起動，editor 頁表單+預覽可用，首頁錯誤狀態正常
- [ ] final commit

## Self-Review
- Spec coverage：表單資訊✓ 動態項目(1–9+)✓ 生成圖片(server route)✓ 即時預覽✓ 儲存/載入✓ 展示頁✓ 三張表✓ RLS✓ zod✓ rhf+useFieldArray✓ HKD✓ zh-HK✓ 主題 config✓ 上載 storage✓ optimistic/loading/empty/error✓ README/SQL/部署步驟✓
