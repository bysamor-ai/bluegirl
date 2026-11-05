# 多租戶白牌化（設計）

日期：2026-11-05
狀態：待用戶覆核
前置條件：**[PR #1](https://github.com/bysamor-ai/bluegirl/pull/1) 先 merge**（呢份 spec 會郁到路由同 schema，兩份改動疊埋一齊好難查問題）

## 1. 目標

將現時只服務 BLUE GIRL 嘅餐牌生成器，變成一個**同一套 code、多個客戶共用**嘅白牌工具：

1. 每個客戶有自己一條 token 網址，網址本身**睇唔出任何品牌名**
2. 客戶開個 app 見到嘅係**自己嘅品牌**（標題、logo、主色、可用底圖），完全見唔到 BLUE GIRL
3. 客戶之間**資料真正隔離** —— 唔單止介面上過濾，而係繞過個 app 都攞唔到隔籬嘅嘢
4. 新增客戶 **唔使改 code、唔使重新部署**

## 2. 決定（已確認）

| 項目 | 決定 |
| --- | --- |
| 形態 | 單一網站多租戶（一條 repo、一個 Vercel project、一個 Supabase） |
| 網址 | `menu-kit.vercel.app/t/<token>`，token 即身分，唔另外設密碼 |
| 域名 | `menu-kit.vercel.app`（已查證未被佔用；原本想要嘅 `menu.vercel.app` 已有人用） |
| 白牌程度 | **完全白牌** —— 標題、logo、主色、可用海報底圖全部跟租戶換 |
| 租戶設定存放 | **Supabase `clients` 表**，唔入 code |
| 資料隔離 | `restaurants.client_id` ＋ 收緊 RLS ＋ server 強制過濾 |
| 現有資料 | Migration 時全部歸去 BLUE GIRL 租戶，唔刪唔改 |

### 點解租戶設定唔入 code

`bysamor-ai/bluegirl` 係 **public repo**。Token 一旦 commit 就等於公開，條 link 即刻失效。放 Supabase 亦順帶解決「新增客戶要重新部署」嘅問題。

## 3. 架構

### 路由

```
src/app/page.tsx                          中性說明頁（「請用你收到嘅連結進入」，唔列租戶）
src/app/t/[token]/layout.tsx              租戶品牌外殼（標題／logo／主色）
src/app/t/[token]/page.tsx                記錄列表
src/app/t/[token]/editor/page.tsx         新建餐牌
src/app/t/[token]/editor/[id]/page.tsx    編輯餐牌
src/app/t/[token]/menu/[id]/page.tsx      展示餐牌
src/app/t/[token]/wall-sticker/page.tsx   牆貼報價工具（PR #1 嗰個，搬入租戶底下）
```

舊路由 `/editor`、`/menu/[id]`、`/wall-sticker` **移除**。BLUE GIRL 自己都改用 token 網址 —— 呢個係「移除網址品牌名」嘅必然結果，現有書籤要換。

根 `layout.tsx` 收返中性（唔再寫死 BLUE GIRL），品牌 header 搬去 `t/[token]/layout.tsx`。

### 新增檔案

```
src/lib/tenant/types.ts        Tenant 型別
src/lib/tenant/resolve.ts      getTenantByToken()（server-only）
src/lib/tenant/resolve.test.ts
src/app/api/t/[token]/restaurants/route.ts        GET / POST（取代 /api/restaurants）
src/app/api/t/[token]/restaurants/[id]/route.ts   GET / DELETE
src/app/api/t/[token]/upload/route.ts             食物相上傳（改由 server 做）
supabase/migrations/2026-11-05-multi-tenant.sql   Migration script
```

### 資料表

```sql
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  name          text not null,
  logo_text     text,
  logo_url      text,
  primary_color text not null default '#2563eb',
  backgrounds   text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists clients_token_idx on public.clients (token);

alter table public.restaurants
  add column if not exists client_id uuid references public.clients (id) on delete cascade;

create index if not exists restaurants_client_idx
  on public.restaurants (client_id, created_at desc);
```

`menu_items`、`generated_images` 經 `restaurant_id` 跟住走，唔加欄位。

`backgrounds` 係字串陣列，列明呢個租戶可用邊幾張底圖（值對應 `src/lib/backgrounds.ts` 嘅 id）。空陣列＝冇品牌底圖，只可以用 4 個主題版面。

## 4. 資料流

1. 瀏覽器要求 `/t/<token>/...`
2. `getTenantByToken(token)` 用 service role 查 `clients`
3. 查唔到 → `notFound()`（出 404，**唔會講「token 錯」**，避免有人逐個試）
4. 查到 → tenant 物件傳落 layout（品牌）同頁面（資料查詢）
5. 所有 `restaurants` 查詢強制加 `.eq("client_id", tenant.id)`
6. 寫入時強制填 `client_id = tenant.id`（**唔接受由 request body 傳入**）

## 5. 安全模型

### 收緊 RLS

1. 新增 `SUPABASE_SERVICE_ROLE_KEY`（server-only，**絕對唔可以用 `NEXT_PUBLIC_` 開頭**）
2. `getSupabaseServerClient()` 改用 service role；**搵唔到就直接拋錯**，唔靜雞雞降級做 anon
3. 刪走 `restaurants`、`menu_items`、`generated_images` 三條 `anon full access (testing)` policy
4. RLS 保持開啟；service role 本身繞過 RLS，所以 server 照行得

收緊之後，就算有人由 bundle 攞到 anon key，直接打 Supabase 都乜都讀唔到。

### 食物相上傳要改寫

`MenuItemRow.tsx` 而家經 `uploadFoodImage()` 由**瀏覽器直接用 anon key** 上傳去 `food-images` bucket。一收緊 anon 權限呢度即刻爛。

改法：

- 新增 `POST /api/t/[token]/upload`，瀏覽器送 `FormData`，server 用 service role 上傳
- 檔案路徑加租戶前綴：`<client_id>/<uuid>.<ext>`
- Server 端驗證：只接受 `image/*`、上限 4 MB（Vercel serverless body 硬上限 4.5MB；瀏覽器端會先縮圖）
- 移除 storage 嘅 `anon upload food-images (testing)` policy
- `src/lib/supabase/client.ts` 成個刪走（`isSupabaseConfigured`、`getSupabaseBrowserClient`、`FOOD_IMAGES_BUCKET` 本身已經冇人用）

Bucket 維持公開讀取 —— 檔名係隨機 uuid，實際上估唔到。**已知取捨**：攞到 URL 嘅人就睇到張相，對餐牌相片而言可接受。

### Token 嘅限制（已知並接受）

- 攞到條 link 就入到，冇第二重驗證
- 會留喺瀏覽器歷史、referrer、Slack／WhatsApp 連結預覽、截圖
- 要「踢走」某人 = 改 DB 嗰行 token，條舊 link 即時失效
- **唔做** rate limiting；token 係 12 位隨機字元（約 62 bits），逐個試唔實際

## 6. Migration 步驟

`supabase/migrations/2026-11-05-multi-tenant.sql` 一個 script 做晒，可重複執行：

1. 建 `clients` 表
2. `restaurants` 加 `client_id`
3. 插入 BLUE GIRL 租戶（token 由 script 產生並 `select` 出嚟畀人抄低）
4. 將**所有** `client_id is null` 嘅現有記錄歸去 BLUE GIRL
5. `client_id` 設為 `not null`
6. 刪走三條 anon policy ＋ storage 嘅 anon upload policy

第二個客戶租戶由用戶自己 `insert` 一行（spec 附 SQL 範本），或者之後做個簡單管理頁。

## 7. 客戶品牌資料

用戶未提供客戶名、logo、品牌色、海報底圖。**唔阻住開工** —— migration 會用中性預設起一行：

| 欄位 | 預設 |
| --- | --- |
| `name` | 「餐牌生成器」 |
| `logo_text` | 客戶名首兩個字（暫時 `菜單`） |
| `logo_url` | `null`（只顯示文字 logo） |
| `primary_color` | `#2563eb` |
| `backgrounds` | `'{}'`（冇品牌底圖，只用 4 個主題版面） |

之後 `update clients set ... where token = '...'` 就改到，**唔使重新部署**。客戶自己嘅海報底圖日後放 `public/backgrounds/` 再加入 `backgrounds` 陣列。

## 8. 錯誤處理

| 情況 | 行為 |
| --- | --- |
| Token 查唔到 | 404 頁，唔透露原因 |
| 冇 `SUPABASE_SERVICE_ROLE_KEY` | 啟動時拋明確錯誤 |
| DB 冷啟動（PGRST205） | 沿用 `retryOnColdStart()`（commit `ea85b7b`），租戶查詢一樣包住 |
| 上傳非圖片／超過 4 MB | 400，中文錯誤訊息 |
| API 收到唔屬於該租戶嘅 `restaurant_id` | 404（唔用 403，避免confirm咗該 id 存在） |

## 9. 測試計劃

**單元測試（vitest）**

- `resolve.test.ts`：查到／查唔到／空 token／冷啟動重試
- 租戶過濾：確認查詢一定帶 `client_id`
- 上傳驗證：檔案類型、大小上限

**人手驗證（本機）**

1. 兩個租戶各自條 link → 各自見到自己嘅記錄，見唔到對方
2. 租戶 A 用租戶 B 嘅 `restaurant_id` 打 API → 404
3. 品牌：標題、logo、主色跟 token 換
4. 亂作 token → 404
5. 上傳食物相 → 經新 API 成功，路徑有租戶前綴
6. 收緊 RLS 後，用 anon key 直接打 Supabase → 攞唔到嘢
7. 現有 5 筆記錄 migration 後仍然喺 BLUE GIRL 租戶入面、內容無變
8. 牆貼工具喺租戶路由下正常運作
9. 手機版 375px

## 10. 部署步驟（要用戶執行）

1. Merge PR #1
2. Supabase 跑 `supabase/migrations/2026-11-05-multi-tenant.sql`，抄低產生嘅 token
3. Vercel 加環境變數 `SUPABASE_SERVICE_ROLE_KEY`（Production + Preview）
4. Vercel → Settings → Domains 改做 `menu-kit.vercel.app`
5. 部署後用 token 網址驗證
6. 將新 link 派俾 BLUE GIRL 同事（舊書籤會失效）

## 11. 風險

| 風險 | 應對 |
| --- | --- |
| Migration 郁到現有 5 筆記錄 | Script 只 `update` `client_id is null` 嘅行，唔掂其他欄位；行之前喺 Supabase 撳一次 backup |
| 舊網址失效，同事搵唔到入口 | 部署前先通知；`/` 中性頁寫明「請向負責同事攞連結」 |
| Service role key 洩漏 | 只喺 server route 同 server component 用；絕不 `NEXT_PUBLIC_`；加入 `.env.example` 註明 |
| Token 流出 | 改 DB 嗰行 token 即時失效 |

## 12. 範圍以外（YAGNI）

- 用戶登入／帳戶系統
- 租戶管理後台（暫時用 SQL `insert`）
- 用量統計、審計 log
- 每個租戶獨立 fal.ai key（共用現有 `FAL_KEY`）
- 自訂域名（之後要再加）
