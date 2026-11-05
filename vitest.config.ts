import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // 對應 tsconfig 嘅 "@/*" -> "src/*"
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
