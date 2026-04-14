// src/components/theme-toggle.tsx
"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  // 增加解构出 resolvedTheme
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <button
      // 使用 resolvedTheme 进行精确判断
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
      aria-label="切换明暗模式"
    >
      {/* 默认（白天）显示月亮，深色模式下将其隐藏 */}
      <Moon className="h-[18px] w-[18px] dark:hidden" />

      {/* 默认（白天）隐藏太阳，深色模式下将其显示 */}
      <Sun className="hidden h-[18px] w-[18px] dark:block" />
    </button>
  );
}
