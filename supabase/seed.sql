-- ============================================================
-- 示範資料 — 喺 schema.sql 之後執行
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
