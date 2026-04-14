"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// attribute="class" 它告诉程序：“当你切换到深色模式时，请给网页最外层的 <html> 标签加上一个名为 dark 的 CSS 类（Class）。”
// defaultTheme="system" 默认跟随系统的状态
// enableSystem网站会持续监听系统的变化
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
