-- ============================================================
-- BLUE GIRL 餐牌生成器 — Supabase Schema
-- 喺 Supabase Dashboard → SQL Editor 執行整份檔案
-- ============================================================

-- ---------- 資料表 ----------

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  theme text not null default 'classic'
    check (theme in ('classic', 'minimal', 'dark', 'promo')),
  background text not null default 'none'
    check (background in ('none', 'gold-landscape', 'gold-portrait', 'white-landscape', 'white-portrait')),
  poster_url text,
  created_at timestamptz not null default now()
);

-- 由舊版 schema 升級用（新裝可略過，重覆執行冇影響）
alter table public.restaurants
  add column if not exists background text not null default 'none';
alter table public.restaurants
  add column if not exists poster_url text;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null default 0 check (price >= 0),
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists menu_items_restaurant_id_idx
  on public.menu_items (restaurant_id, sort_order);

create table if not exists public.generated_images (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete set null,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  prompt text not null,
  image_url text not null,
  provider text not null default 'fal.ai',
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- 測試設定：開啟 RLS，但畀 anon 角色完整讀寫權限。
-- 上正式環境前應收緊（例如只限已登入用戶）。

alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.generated_images enable row level security;

drop policy if exists "anon full access (testing)" on public.restaurants;
create policy "anon full access (testing)"
  on public.restaurants for all
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "anon full access (testing)" on public.menu_items;
create policy "anon full access (testing)"
  on public.menu_items for all
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "anon full access (testing)" on public.generated_images;
create policy "anon full access (testing)"
  on public.generated_images for all
  to anon, authenticated
  using (true) with check (true);

-- ---------- Storage：food-images bucket ----------
-- 公開讀取；anon 可上傳（測試設定）

insert into storage.buckets (id, name, public)
values ('food-images', 'food-images', true)
on conflict (id) do nothing;

drop policy if exists "public read food-images" on storage.objects;
create policy "public read food-images"
  on storage.objects for select
  using (bucket_id = 'food-images');

drop policy if exists "anon upload food-images (testing)" on storage.objects;
create policy "anon upload food-images (testing)"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'food-images');
