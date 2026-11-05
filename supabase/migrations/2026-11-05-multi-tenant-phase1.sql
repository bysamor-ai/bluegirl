-- ============================================================
-- 多租戶 Phase 1 migration（純新增，可重複執行）
-- 喺 Supabase Dashboard → SQL Editor 執行整份檔案。
-- 執行前請先喺 Supabase 撳一次 backup。
--
-- 本期只新增：唔改、唔刪任何 policy，亦唔加 not null，
-- 因為線上舊版仍然用緊 anon key，要繼續行得通。
-- ============================================================

-- 1. 產生租戶 token（12 個英數字元）
--    gen_random_bytes 屬 pgcrypto（Supabase 放喺 extensions schema），
--    所以明確設定 search_path，避免呼叫者環境唔同而搵唔到。
create or replace function public.generate_client_token()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select substr(
    regexp_replace(encode(gen_random_bytes(18), 'base64'), '[^a-zA-Z0-9]', '', 'g'),
    1, 12
  );
$$;

-- 2. 租戶表
create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  token             text not null unique default public.generate_client_token(),
  name              text not null,
  logo_text         text,
  logo_url          text,
  primary_color     text not null default '#2563eb',
  backgrounds       text[] not null default '{}',
  -- 可唔可以喺 AI 生成嘅素材出品牌標誌。預設 false（白牌租戶）。
  -- 刻意同 backgrounds 分開：「有冇海報底圖」同「可唔可以出品牌標誌」
  -- 係兩件唔同嘅事，唔可以用前者做後者嘅開關。
  allow_brand_marks boolean not null default false,
  -- allow_brand_marks = true 時拼落 AI prompt 嘅品牌描述（自由文字）
  brand_prompt      text,
  created_at        timestamptz not null default now()
);

-- 由舊版 migration 升級用（新裝可略過，重覆執行冇影響）
alter table public.clients
  add column if not exists allow_brand_marks boolean not null default false;
alter table public.clients
  add column if not exists brand_prompt text;

-- 3. token 索引
create index if not exists clients_token_idx on public.clients (token);

-- 新表即開 RLS 並且不設任何 policy：anon 讀唔到租戶 token，
-- 只有 service role（伺服器端）可以存取。舊版唔使用呢張表，所以唔受影響。
alter table public.clients enable row level security;

-- 4. restaurants 加 client_id（可為 null，Phase 2 之後先收緊）
alter table public.restaurants
  add column if not exists client_id uuid references public.clients (id) on delete cascade;

-- 5. 按租戶列出記錄用嘅索引
create index if not exists restaurants_client_idx
  on public.restaurants (client_id, created_at desc);

-- 6. BLUE GIRL 租戶（已存在就唔再插入）
--    name 係品牌名唔係工具名：tenant.name 同時做 UI 標題同 AI prompt 嘅品牌名，
--    拼落 prompt 嘅話「BLUE GIRL 餐牌生成器」會變成一個唔存在嘅品牌。
insert into public.clients (
  token, name, logo_text, primary_color, backgrounds, allow_brand_marks, brand_prompt
)
select
  public.generate_client_token(),
  'BLUE GIRL',
  'BG',
  '#2563eb',
  array['gold-landscape', 'gold-portrait', 'white-landscape', 'white-portrait'],
  true,
  'a BLUE GIRL beer bottle, navy and gold brand palette'
where not exists (
  select 1 from public.clients where name = 'BLUE GIRL'
);

-- 7. 中性客戶租戶（已存在就唔再插入）
insert into public.clients (token, name, logo_text, primary_color, backgrounds)
select
  public.generate_client_token(),
  '餐牌生成器',
  '菜單',
  '#2563eb',
  '{}'
where not exists (
  select 1 from public.clients where name = '餐牌生成器'
);

-- 8. 現有 restaurants 全部歸入 BLUE GIRL 租戶（只補未有 client_id 嘅）
--    subquery 用 limit 1：clients.name 冇 unique constraint，
--    萬一有重複行，冇 limit 1 會直接報錯，而且係喺 production 資料上面行。
update public.restaurants
set client_id = (
  select id from public.clients where name = 'BLUE GIRL' limit 1
)
where client_id is null;

-- 9. 輸出兩個租戶嘅 token —— 請抄低（兩條都要）
select token, name from public.clients order by created_at;
