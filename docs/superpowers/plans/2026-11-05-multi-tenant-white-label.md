# 多租戶白牌化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將單一品牌嘅餐牌生成器變成多租戶白牌工具 —— 每個客戶一條 token 網址，見到自己嘅品牌，資料互相隔離。

**Architecture:** 租戶資料放 Supabase `clients` 表（唔入 public repo）。所有頁面搬去 `/t/[token]/*`，server 端用 token 查租戶再強制用 `client_id` 過濾。Server client 由 anon key 轉用 service role，anon 直接打 DB 嘅權限整個移除。

**Tech Stack:** Next.js 15 App Router・TypeScript・Tailwind v4・Supabase（Postgres + Storage）・vitest

**Spec:** [docs/superpowers/specs/2026-11-05-multi-tenant-white-label-design.md](../specs/2026-11-05-multi-tenant-white-label-design.md)

## Global Constraints

- 所有介面文字用**繁體中文（香港）**
- `SUPABASE_SERVICE_ROLE_KEY` **只限 server**，絕不可改用 `NEXT_PUBLIC_` 前綴
- Token 查唔到一律 `notFound()`（404），**唔可以**回覆「token 唔啱」之類訊息
- 跨租戶資源一律 404，**唔用 403**
- 所有 `restaurants` 查詢必須帶 `client_id`；寫入時 `client_id` 由 server 填，**永不接受 request body 傳入**
- Token 格式：12 個英數字元，由 `public.generate_client_token()` 產生
- 上傳上限 **10 MB**，只接受 `image/*`
- 每個 task 完成後 `npm test`、`npx tsc --noEmit` 必須全過

## ⚠️ 本機同 production 共用同一個 Supabase

`.env.local` 同 Vercel 都指向 `neuuukiouysedhbscqsa`，**冇 staging**。所以 migration 拆兩期：

| 期 | 內容 | 時機 |
| --- | --- | --- |
| **Phase 1**（Task 1） | 新增 `clients` 表、`restaurants.client_id`、回填 | 寫 code 之前；純新增，線上舊版照常運作 |
| **Phase 2**（Task 8） | 刪走 anon policies | **新版部署並驗證之後**；早做會即刻整爛線上版 |

同理，`SUPABASE_SERVICE_ROLE_KEY` 要喺部署新 code **之前**加落 Vercel，否則 production 起唔到。

## Review Focus

1. **Token 前後有空白或大小寫唔同**（`/t/Abc123%20`）→ 應該 404，唔可以因為 trim 唔乾淨而 500 — Task 2
2. **空 token**（`/t/`、`/t//editor`）→ 應該 404，唔可以拋未捕捉錯誤 — Task 2
3. **跨租戶 `restaurant_id`**（A 租戶用 B 嘅 id 打 API）→ 404，唔可以洩露存在與否 — Task 4
4. **Request body 夾帶 `client_id`** 企圖寫入第二個租戶 → 必須被無視 — Task 4
5. **`clients.backgrounds` 入面有唔存在嘅 background id** → 要靜靜過濾走，唔可以令頁面爆 — Task 2（`toTenant` 測試）

---

### Task 1: Phase 1 Migration（純新增，唔影響線上）

**Files:**
- Create: `supabase/migrations/2026-11-05-multi-tenant-phase1.sql`
- Modify: `README.md`（新增「多租戶」一節同 `SUPABASE_SERVICE_ROLE_KEY` 說明）
- Modify: `.env.example`（加 `SUPABASE_SERVICE_ROLE_KEY=`）

**Interfaces:**
- Consumes: 無
- Produces: `public.clients` 表、`public.restaurants.client_id` 欄位、`public.generate_client_token() -> text`

- [ ] **Step 1: 寫 migration script**

內容（可重複執行）：
1. `create or replace function public.generate_client_token() returns text` — 回傳 12 個英數字元，實作用 `substr(regexp_replace(encode(gen_random_bytes(18),'base64'), '[^a-zA-Z0-9]', '', 'g'), 1, 12)`
2. `create table if not exists public.clients`，欄位照 spec 第 3 節
3. `create index if not exists clients_token_idx on public.clients (token)`
4. `alter table public.restaurants add column if not exists client_id uuid references public.clients (id) on delete cascade`
5. `create index if not exists restaurants_client_idx on public.restaurants (client_id, created_at desc)`
6. 插入 BLUE GIRL 租戶（`on conflict do nothing`，用 `name = 'BLUE GIRL 餐牌生成器'`、`logo_text = 'BG'`、`primary_color = '#2563eb'`、`backgrounds = array['gold-landscape','gold-portrait','white-landscape','white-portrait']`）
7. 再插入一個中性客戶租戶（`name = '餐牌生成器'`、`logo_text = '菜單'`、`primary_color = '#2563eb'`、`backgrounds = '{}'`），同樣 `on conflict do nothing`
8. `update public.restaurants set client_id = (select id from public.clients where name = 'BLUE GIRL 餐牌生成器') where client_id is null`
9. 最後 `select token, name from public.clients` 畀人抄低（**兩條 token 都要**）

**注意：呢期唔好加 `not null`，亦唔好掂任何 policy** —— 線上舊版仲用緊 anon，要繼續行得通。

- [ ] **Step 2: 用戶喺 Supabase SQL Editor 執行**

執行前喺 Supabase 撳一次 backup。執行後抄低輸出嘅 token。

- [ ] **Step 3: 核實冇整爛現有資料**

Run:
```sql
select count(*) as total, count(client_id) as assigned from public.restaurants;
```
Expected: `total` 同 `assigned` 相等（兩個都係 5）

- [ ] **Step 4: 核實線上舊版仍然正常**

開 https://bluegirl-dysf.vercel.app/ ，Expected: 5 筆記錄照樣顯示

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026-11-05-multi-tenant-phase1.sql README.md .env.example
git commit -m "feat: 多租戶 Phase 1 migration（clients 表 + client_id 回填）"
```

---

### Task 2: 租戶解析

**Files:**
- Create: `src/lib/tenant/types.ts`
- Create: `src/lib/tenant/resolve.ts`
- Test: `src/lib/tenant/resolve.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()`（Task 3 之前仍係 anon 版，簽名不變）、`retryOnColdStart()` from `@/lib/supabase/cold-start`
- Produces:
  - `interface ClientRow { id: string; token: string; name: string; logo_text: string | null; logo_url: string | null; primary_color: string; backgrounds: string[]; created_at: string }`
  - `interface Tenant { id: string; token: string; name: string; logoText: string | null; logoUrl: string | null; primaryColor: string; backgrounds: BackgroundId[] }`
  - `export function normalizeToken(raw: string): string | null`
  - `export function toTenant(row: ClientRow): Tenant`
  - `export async function getTenantByToken(raw: string): Promise<Tenant | null>`

- [ ] **Step 1: 寫 failing tests**

```ts
describe("normalizeToken", () => {
  it("剪走前後空白", () => expect(normalizeToken("  abc123DEF456 ")).toBe("abc123DEF456"));
  it("空字串回 null", () => expect(normalizeToken("")).toBeNull());
  it("淨係空白回 null", () => expect(normalizeToken("   ")).toBeNull());
  it("含非英數字元回 null", () => expect(normalizeToken("abc/../def")).toBeNull());
  it("長度唔啱回 null", () => expect(normalizeToken("abc")).toBeNull());
  it("大小寫照留（token 分大小寫）", () => expect(normalizeToken("AbCdEf123456")).toBe("AbCdEf123456"));
});

describe("toTenant", () => {
  it("snake_case 轉 camelCase", () => { /* 全部欄位對照 */ });
  it("過濾走唔存在嘅 background id", () => {
    const t = toTenant({ ...row, backgrounds: ["gold-landscape", "not-a-real-bg"] });
    expect(t.backgrounds).toEqual(["gold-landscape"]);
  });
  it("backgrounds 係 null 時回空陣列", () => { /* ... */ });
});

describe("getTenantByToken", () => {
  it("查到就回 Tenant", async () => { /* mock supabase 回 row */ });
  it("查唔到回 null", async () => { /* mock 回 data: null */ });
  it("token 格式唔啱時唔會打 DB", async () => { /* 確認 mock 冇被呼叫 */ });
  it("冷啟動 error 會重試", async () => { /* 第一次回 PGRST205，第二次成功 */ });
});
```

用 `vi.mock("@/lib/supabase/server")` 造假 client。

- [ ] **Step 2: 行測試確認失敗**

Run: `npx vitest run src/lib/tenant/resolve.test.ts`
Expected: FAIL — 搵唔到模組

- [ ] **Step 3: 實作三個函數**

`normalizeToken` 用 `/^[A-Za-z0-9]{12}$/` 驗證。`getTenantByToken` 先 `normalizeToken`，回 `null` 就**即刻返回唔好打 DB**，否則 `.from("clients").select(...).eq("token", token).maybeSingle()` 包喺 `retryOnColdStart()` 入面。

- [ ] **Step 4: 行測試確認通過**

Run: `npx vitest run src/lib/tenant/resolve.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tenant/
git commit -m "feat: 租戶解析（normalizeToken / toTenant / getTenantByToken）"
```

---

### Task 3: Server client 轉用 service role

**Files:**
- Modify: `src/lib/supabase/server.ts`
- Test: `src/lib/supabase/server.test.ts`

**Interfaces:**
- Consumes: 環境變數 `SUPABASE_SERVICE_ROLE_KEY`
- Produces: `getSupabaseServerClient(): SupabaseClient`（簽名不變，行為改變）

- [ ] **Step 1: 寫 failing tests**

```ts
it("冇 SUPABASE_SERVICE_ROLE_KEY 就拋明確錯誤", () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(() => getSupabaseServerClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
});
it("唔會靜靜降級用 anon key", () => { /* 只設 anon key，仍然要拋錯 */ });
it("齊變數時建到 client", () => { /* ... */ });
```

- [ ] **Step 2: 行測試確認失敗**

Run: `npx vitest run src/lib/supabase/server.test.ts`
Expected: FAIL — 而家只設 anon key 都唔會拋錯

- [ ] **Step 3: 改 `getSupabaseServerClient()`**

讀 `SUPABASE_SERVICE_ROLE_KEY` 代替 `NEXT_PUBLIC_SUPABASE_ANON_KEY`；缺少任何一個就 `throw new Error(...)`，訊息要講明變數名同「只限伺服器」。**唔准 fallback 去 anon。**

- [ ] **Step 4: 行測試 + 本機行一次 app**

Run: `npx vitest run src/lib/supabase/server.test.ts` → PASS
將 service role key 加入 `.env.local`，`npm run dev`，開首頁 → 5 筆記錄仍然顯示

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/server.ts src/lib/supabase/server.test.ts
git commit -m "feat: server client 改用 service role，缺 key 即拋錯"
```

---

### Task 4: 租戶化 API routes

**Files:**
- Create: `src/app/api/t/[token]/restaurants/route.ts`（GET、POST）
- Create: `src/app/api/t/[token]/restaurants/[id]/route.ts`（GET、DELETE）
- Delete: `src/app/api/restaurants/route.ts`、`src/app/api/restaurants/[id]/route.ts`
- Modify: `src/components/MenuForm.tsx:132`、`src/components/RestaurantList.tsx:28`（改 fetch 路徑）
- Test: `src/app/api/t/[token]/restaurants/route.test.ts`

**Interfaces:**
- Consumes: `getTenantByToken()`（Task 2）、`getSupabaseServerClient()`（Task 3）、`restaurantFormSchema` from `@/lib/schemas`
- Produces: `GET|POST /api/t/<token>/restaurants`、`GET|DELETE /api/t/<token>/restaurants/<id>`
- 前端元件需要知道自己嘅 token，由 props 傳入（Task 6 接線）

- [ ] **Step 1: 寫 failing tests**

```ts
it("token 查唔到回 404", async () => { /* ... */ });
it("GET 只回該租戶嘅記錄", async () => { /* 斷言查詢帶 .eq("client_id", tenant.id) */ });
it("POST 用 server 嘅 client_id，無視 body 夾帶嘅", async () => {
  // body 入面放 client_id: "其他租戶"，斷言 insert 收到嘅係 tenant.id
});
it("GET 單筆：唔屬於該租戶回 404", async () => { /* ... */ });
it("DELETE：唔屬於該租戶回 404 而且冇刪到嘢", async () => { /* ... */ });
```

- [ ] **Step 2: 行測試確認失敗**

Run: `npx vitest run src/app/api/t/`
Expected: FAIL — 搵唔到模組

- [ ] **Step 3: 實作 routes**

由舊 `src/app/api/restaurants/*` 搬過嚟，每個 handler 開頭先 `const tenant = await getTenantByToken(params.token)`，`null` 就回 `NextResponse.json({ error: "搵唔到" }, { status: 404 })`。所有查詢加 `.eq("client_id", tenant.id)`；`insert` 時明確寫 `client_id: tenant.id`。

- [ ] **Step 4: 行測試 + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: 全過

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ src/components/MenuForm.tsx src/components/RestaurantList.tsx
git commit -m "feat: API routes 租戶化，client_id 由 server 強制"
```

---

### Task 5: 食物相上傳改由 server 處理

**Files:**
- Create: `src/lib/tenant/upload-validation.ts`
- Create: `src/app/api/t/[token]/upload/route.ts`
- Modify: `src/components/MenuItemRow.tsx:6,52`
- Delete: `src/lib/supabase/client.ts`
- Test: `src/lib/tenant/upload-validation.test.ts`

**Interfaces:**
- Consumes: `getTenantByToken()`、`getSupabaseServerClient()`
- Produces:
  - `export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024`
  - `export function validateUpload(file: { type: string; size: number }): string | null`（回錯誤訊息，`null` 代表無問題）
  - `POST /api/t/<token>/upload`，收 `FormData`（欄位名 `file`），回 `{ url: string }`

- [ ] **Step 1: 寫 failing tests**

```ts
it("接受 image/jpeg", () => expect(validateUpload({ type: "image/jpeg", size: 1000 })).toBeNull());
it("拒絕非圖片", () => expect(validateUpload({ type: "application/pdf", size: 1000 })).toMatch(/圖片/));
it("拒絕超過 10MB", () => expect(validateUpload({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/10/));
it("啱啱 10MB 可以接受", () => expect(validateUpload({ type: "image/png", size: MAX_UPLOAD_BYTES })).toBeNull());
it("拒絕 0 byte", () => expect(validateUpload({ type: "image/png", size: 0 })).not.toBeNull());
```

- [ ] **Step 2: 行測試確認失敗**

Run: `npx vitest run src/lib/tenant/upload-validation.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作驗證 + upload route + 改元件**

Route：解析 token → 攞 `FormData` → `validateUpload` → 用 service role 上傳去 `food-images`，路徑 `${tenant.id}/${crypto.randomUUID()}.${ext}` → 回 `getPublicUrl`。
`MenuItemRow.tsx` 改成 `fetch('/api/t/<token>/upload', { method: 'POST', body: formData })`，token 由 props 傳入。
刪走 `src/lib/supabase/client.ts`（其餘 export 本身冇人用）。

- [ ] **Step 4: 行測試 + 本機實測上傳一張相**

Run: `npm test && npx tsc --noEmit` → 全過
本機編輯器上傳一張相 → 成功，URL 路徑有租戶 id 前綴

- [ ] **Step 5: Commit**

```bash
git add src/lib/tenant/upload-validation.ts src/app/api/t/ src/components/MenuItemRow.tsx
git rm src/lib/supabase/client.ts
git commit -m "feat: 食物相上傳改經 server route，路徑加租戶前綴"
```

---

### Task 6: 路由搬去 /t/[token]

**Files:**
- Create: `src/app/t/[token]/page.tsx`、`editor/page.tsx`、`editor/[id]/page.tsx`、`menu/[id]/page.tsx`、`wall-sticker/page.tsx`
- Modify: `src/app/page.tsx`（改成中性說明頁）
- Delete: `src/app/editor/`、`src/app/menu/`、`src/app/wall-sticker/`

**Interfaces:**
- Consumes: `getTenantByToken()`、Task 4 嘅 API 路徑
- Produces: 每頁由 `params.token` 取得 `tenant`，傳落元件；元件收多一個 `token: string` prop

- [ ] **Step 1: 搬頁面**

每頁開頭：
```ts
const tenant = await getTenantByToken((await params).token);
if (!tenant) notFound();
```
記錄列表查詢加 `.eq("client_id", tenant.id)`，沿用 `retryOnColdStart()`。

- [ ] **Step 2: 首頁改中性**

`src/app/page.tsx` 顯示「請用你收到嘅連結進入」，**唔可以列出任何租戶或 token**。移除 `RestaurantList` 同資料庫查詢。

- [ ] **Step 3: 本機驗證**

`npm run dev`，逐項確認：
- `/t/<blue-girl-token>` → 5 筆記錄
- `/t/<blue-girl-token>/editor` → 表單正常
- `/t/zzzzzzzzzzzz` → 404
- `/t/` → 404（唔可以 500）
- `/` → 中性說明頁，冇列租戶
- `/editor` → 404（舊路由已移除）

- [ ] **Step 4: typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 全過

- [ ] **Step 5: Commit**

```bash
git add src/app/
git commit -m "feat: 所有頁面搬去 /t/[token]，首頁改中性說明"
```

---

### Task 7: 白牌品牌外殼

**Files:**
- Create: `src/app/t/[token]/layout.tsx`
- Modify: `src/app/layout.tsx`（收返中性）
- Modify: `src/components/EditorShell.tsx`、`MenuForm.tsx`（背景選項改由 `tenant.backgrounds` 決定）

**Interfaces:**
- Consumes: `Tenant`（Task 2）、`backgroundIds` from `@/lib/backgrounds`
- Produces: 租戶 layout 匯出 `generateMetadata()` 回 `{ title: tenant.name }`

- [ ] **Step 1: 根 layout 收返中性**

移除 `BG` logo、「BLUE GIRL 餐牌生成器」字樣同導覽列；只留 `<html lang="zh-HK">` 同 `<body>`。

- [ ] **Step 2: 租戶 layout**

顯示 `tenant.logoUrl` 有就出圖、冇就出 `tenant.logoText` 文字 logo；主色用 `tenant.primaryColor`，經 CSS 變數 `--brand` 落去（唔好散落各處寫死 class）。導覽連結全部指向 `/t/<token>/...`。

- [ ] **Step 3: 背景選項跟租戶**

`MenuForm` 嘅背景揀選器只列 `tenant.backgrounds` 入面嘅選項，加上「無背景」。`tenant.backgrounds` 空陣列時**只得「無背景」**，`Gen Image` 掣維持停用（沿用現有「請先揀選一個品牌背景」邏輯）。

- [ ] **Step 4: 本機驗證兩個租戶**

用 Task 1 已經建好嘅兩條 token（BLUE GIRL ＋ 中性客戶租戶）逐一開，確認：
- 瀏覽器標題跟租戶換
- 頁頂 logo 同主色跟租戶換
- 測試租戶見唔到任何 BLUE GIRL 字樣或底圖
- 測試租戶記錄列表係空（見唔到 BLUE GIRL 嗰 5 筆）
- 手機版 375px：兩個租戶嘅版面都正常

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/t/ src/components/
git commit -m "feat: 白牌品牌外殼（標題／logo／主色／底圖跟租戶）"
```

---

### Task 8: 部署 + Phase 2 鎖緊

**Files:**
- Create: `supabase/migrations/2026-11-05-multi-tenant-phase2-lockdown.sql`
- Modify: `README.md`（部署步驟、新增客戶 SQL 範本）

**Interfaces:**
- Consumes: Task 1–7 全部完成並驗證
- Produces: 收緊咗嘅 RLS

- [ ] **Step 1: 寫 lockdown script**

```sql
drop policy if exists "anon full access (testing)" on public.restaurants;
drop policy if exists "anon full access (testing)" on public.menu_items;
drop policy if exists "anon full access (testing)" on public.generated_images;
drop policy if exists "anon upload food-images (testing)" on storage.objects;
alter table public.restaurants alter column client_id set not null;
```

- [ ] **Step 2: 用戶喺 Vercel 加環境變數**

`SUPABASE_SERVICE_ROLE_KEY`（Production + Preview），**唔好用 `NEXT_PUBLIC_` 前綴**。

- [ ] **Step 3: 部署並驗證（lockdown 之前）**

Merge 落 `main` → Vercel 自動部署。確認：
- `/t/<token>` 顯示 5 筆記錄
- `/t/<token>/editor` 儲存得到
- 上傳相片成功
- `/` 係中性說明頁

**呢步未過唔好行 Step 4。**

- [ ] **Step 4: 執行 lockdown script**

喺 Supabase SQL Editor 行 phase2 script。

- [ ] **Step 5: 驗證隔離真係生效**

Run（用 anon key，應該攞唔到嘢）：
```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/restaurants?select=id&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```
Expected: 回空陣列或權限錯誤，**唔可以**回到真實記錄

再確認網站本身仍然正常（service role 唔受 RLS 限制）。

- [ ] **Step 6: Vercel 改域名**

Settings → Domains → 加 `menu-kit.vercel.app`。

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/ README.md
git commit -m "feat: Phase 2 鎖緊 RLS + 部署文件"
```

---

## 未解決事項

- **客戶顯示名未定** —— Task 1 用中性名 `餐牌生成器` 頂住；日後 `update public.clients set name = '...' where token = '...'`，**唔使重新部署**
- **客戶海報底圖未有** —— `backgrounds` 留空陣列，只用主題色版面；日後將圖放 `public/backgrounds/`、加入 `src/lib/backgrounds.ts`、再更新該租戶嘅 `backgrounds`
