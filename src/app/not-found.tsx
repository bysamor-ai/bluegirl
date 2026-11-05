import StatusCard from "@/components/StatusCard";

// 連結（token）無效時會落呢頁：刻意中性，唔透露有邊啲客戶存在
export default function NotFound() {
  return (
    <StatusCard
      title="搵唔到呢個頁面"
      message="請確認連結正確，或者聯絡同你對接嘅同事重新發送。"
    />
  );
}
