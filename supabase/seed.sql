-- ============================================================
-- 示範資料 — 喺 schema.sql 之後執行
--
-- ⚠️ 多租戶化之後，呢份 script 已經過時。
--    下面個 insert 冇填 client_id，而所有租戶頁面都係用
--    `.eq("client_id", tenant.id)` 過濾 —— `.eq()` 唔會 match NULL，
--    所以跑完之後呢筆示範記錄**任何租戶都見唔到**（fail-closed）。
--
--    真係要示範資料嘅話，自己補返 client_id：
--      insert into public.restaurants (name, theme, client_id)
--      values ('示範茶餐廳', 'classic',
--              (select id from public.clients where name = 'BLUE GIRL' limit 1))
-- ============================================================

with r as (
  insert into public.restaurants (name, theme)
  values ('藍妹茶餐廳', 'classic')
  returning id
)
insert into public.menu_items (restaurant_id, name, price, image_url, sort_order)
select r.id, v.name, v.price, null, v.sort_order
from r,
  (values
    ('招牌菠蘿油', 22.00, 0),
    ('絲襪奶茶', 20.00, 1),
    ('乾炒牛河', 68.00, 2),
    ('西多士', 26.00, 3),
    ('楊枝甘露', 32.00, 4)
  ) as v (name, price, sort_order);
