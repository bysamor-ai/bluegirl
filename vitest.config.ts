import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig 嘅 `jsx` 係 "preserve"（交俾 Next.js 處理），esbuild 會 fallback 去
  // classic 轉換（React.createElement）而測試環境冇 global React。
  // server component 測試要 import .tsx 頁面，所以明確叫 esbuild 用 automatic runtime。
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      // 對應 tsconfig 嘅 "@/*" -> "src/*"
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` 靠 "react-server" export condition 分流：Next.js 喺 server
      // 會攞 empty.js，其他環境攞 index.js（會拋錯）。Vitest 唔係 react-server
      // 環境，所以明確指去 package 自己嗰個空模組，等伺服器端模組測試得到。
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url)
      ),
    },
  },
});
