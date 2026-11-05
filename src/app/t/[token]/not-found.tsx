import StatusCard from "@/components/StatusCard";

// 喺租戶 layout 入面，所以會帶租戶頁首
export default function TenantNotFound() {
  return (
    <StatusCard
      title="搵唔到呢個頁面"
      message="呢筆記錄可能已經被刪除，或者連結唔正確。請返回記錄頁再揀。"
    />
  );
}
