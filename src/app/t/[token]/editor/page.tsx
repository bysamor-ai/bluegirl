import EditorShell from "@/components/EditorShell";
import { getTenantFromParams, type TenantRouteParams } from "@/lib/tenant/params";

export const dynamic = "force-dynamic";
export const metadata = { title: "建立新餐牌" };

export default async function NewEditorPage({
  params,
}: {
  params: Promise<TenantRouteParams>;
}) {
  // 就算呢頁唔使查資料庫，都要確認 token 有效，唔可以俾人用亂 token 入到工具
  const tenant = await getTenantFromParams(params);

  return <EditorShell token={tenant.token} />;
}
