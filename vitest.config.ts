import { defineConfig } from "vitest/config";
import path from "path";

// defineConfig 仅用于提供准确的配置项代码补全和参数类型检查，避免写错配置名。
export default defineConfig({
  test: {
    // 我们测的都是纯逻辑（不涉及浏览器 DOM），所以用最轻量的 node 环境
    environment: "node",
  },
  resolve: {
    alias: {
      // 让测试文件里也能用 "@/..." 这种路径（等价于 src/...）
      // 否则测试里 import "@/lib/..." 会找不到文件
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
