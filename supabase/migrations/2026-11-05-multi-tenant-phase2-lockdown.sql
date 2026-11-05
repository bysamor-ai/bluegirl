-- ============================================================
-- 多租戶 Phase 2：鎖緊 anon 權限（可重複執行）
-- 喺 Supabase Dashboard → SQL Editor 執行整份檔案。
--
-- ⚠️ 執行時機：**新版部署並驗證之後先至好跑。**
--    跑之前：revert 條 merge 就可以完全返轉頭（線上舊版用 anon key，
--            而呢啲 policy 仲喺度，舊版照行）。
--    跑之後：呢條退路就冇咗 —— 舊版再冇 anon 權限打 DB，
--            revert 只會換嚟一個行唔到嘅版本。要返轉頭就要手動重建 policy。
--    所以請先確認：/t/<token> 列到記錄、editor 儲存得到、上傳相片成功、
--    AI 生成行得到，先至執行呢份檔案。
--
-- 執行前請先喺 Supabase 撳一次 backup。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 再回填一次 client_id
--    Phase 1 跑完之後、新版上線之前嗰段時間，線上舊版仍然會
--    insert client_id = null 嘅記錄。唔補返嘅話呢啲記錄會變孤兒
--    （所有查詢都帶 .eq("client_id", …)，NULL 永遠唔 match），
--    用戶會見到「記錄唔見咗」。
--
--    subquery 用 limit 1：clients.name 冇 unique constraint，
--    萬一有重複行，冇 limit 1 會直接報錯，而且係喺 production 資料上面行。
-- ------------------------------------------------------------
update public.restaurants
set client_id = (
  select id from public.clients where name = 'BLUE GIRL' limit 1
)
where client_id is null;

-- ------------------------------------------------------------
-- 2. 刪走三張表嘅 anon 全權限測試 policy
--    新版所有 DB 存取都行 service role（繞過 RLS），
--    anon 已經唔需要任何直接權限。
-- ------------------------------------------------------------
drop policy if exists "anon full access (testing)" on public.restaurants;
drop policy if exists "anon full access (testing)" on public.menu_items;
drop policy if exists "anon full access (testing)" on public.generated_images;

-- ------------------------------------------------------------
-- 3. 刪走 storage 嘅 anon 上傳 policy
--    上傳已經改經 /api/t/<token>/upload，由伺服器用 service role 寫入。
-- ------------------------------------------------------------
drop policy if exists "anon upload food-images (testing)" on storage.objects;

-- ------------------------------------------------------------
-- 4. 刪走 food-images 嘅 public read select policy（⚠️ 見下面「假設」）
--
--    問題：檔案路徑加咗 <client_id>/ 前綴之後，
--    POST /storage/v1/object/list/food-images 用 anon key 係打得通嘅
--    （已實測）。租戶 A 可以 list('') 攞到所有 client_id，
--    再 list('<租戶 B 嘅 id>') 攞到對方每張相嘅確切檔名，然後公開讀取。
--
--    做法：刪 select policy，但 **bucket 保持 public**。
--
--    ⚠️ 假設（未實測）：bucket 係 public 嘅話，
--    /storage/v1/object/public/... 呢個公開端點唔經 RLS，所以圖片照樣顯示到；
--    而 /storage/v1/object/list/... 要 select policy，刪咗就列舉唔到。
--
--    執行之後 **必須即刻驗證兩樣嘢**（兩條 curl 見 README「Phase 2 鎖緊」一節）：
--      a) 圖片仍然顯示得到（public 端點回 200 + image/*）
--      b) 列舉已經失效（list 端點回空陣列或 4xx）
--
--    如果 (a) 爛咗：退路係改用 signed URL（`createSignedUrl`，
--    所有 image_url 要改成短期簽名連結，涉及上傳、儲存、展示三處），
--    範圍大，屬日後工作。臨時止血可以重建返呢條 policy：
--      create policy "public read food-images" on storage.objects
--        for select using (bucket_id = 'food-images');
--    （即係接受返列舉漏洞，直到 signed URL 做好為止。）
-- ------------------------------------------------------------
drop policy if exists "public read food-images" on storage.objects;

-- ------------------------------------------------------------
-- 5. 順手清走牆貼工具嘅死碼 + 開放寫入
--    wall_sticker_jobs 表同 wall-stickers bucket 喺 src/ 入面零引用
--    （報價同效果圖全部喺瀏覽器計，根本冇寫過入去），
--    但 policy 係 anon 全權限 + anon 可上傳，等於一個冇人用、
--    又可以俾任何人寫入嘅出入口。
--    只刪 policy，唔刪表同 bucket（保守，萬一真係有歷史資料）。
-- ------------------------------------------------------------
drop policy if exists "anon full access (testing)" on public.wall_sticker_jobs;
drop policy if exists "public read wall-stickers" on storage.objects;
drop policy if exists "anon upload wall-stickers (testing)" on storage.objects;

-- ------------------------------------------------------------
-- 6. 刻意唔做：alter table public.restaurants
--                alter column client_id set not null;
--
--    理由：孤兒記錄（client_id is null）本身已經係 fail-closed ——
--    所有查詢都帶 .eq("client_id", tenant.id)，而 Postgres 嘅 = 永遠
--    唔會 match NULL，所以孤兒記錄冇任何租戶睇得到，亦唔會洩露。
--    not null 帶嚟嘅邊際防護好細，但佢會喺 production SQL Editor 中途
--    爆（只要仲有一筆 client_id is null —— 例如上面第 1 步嘅 subquery
--    搵唔到 'BLUE GIRL' 租戶），令成份 script 前功盡廢，風險唔細。
--    如果日後真係想加，先確認 `select count(*) from public.restaurants
--    where client_id is null;` 係 0，再單獨行嗰一句。
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 7. 核實：應該回 0（即係冇孤兒記錄）
-- ------------------------------------------------------------
select count(*) as orphan_restaurants
from public.restaurants
where client_id is null;
