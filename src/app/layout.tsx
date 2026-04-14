import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

// children：这是一个特殊的参数。在 Layout 中，它代表当前正在访问的具体页面内容。
// suppressHydrationWarning：这是一个“防报错开关”
// React.ReactNode是 children 的类型。它告诉计算机：“只要是 React 能渲染的东西（文字、标签、组件等），都可以传进来。”
// Readonly<{ ... }>：这是一种保护机制，告诉程序：这个 children 参数是“只读”的，你不准在函数内部修改它。
export const metadata: Metadata = {
  title: "Chenyu",
  description: "Chenyu 的个人技术博客与作品集",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      {/* 添加 flex min-h-screen flex-col，
        确保即使页面内容很少，Footer 也能被推到屏幕最底部 
      */}
      <body className="flex min-h-screen flex-col text-text-secondary bg-background antialiased">
        <ThemeProvider>
          <Navbar />
          {/* flex-1 让 main 区域自动撑开剩余空间
          antialiased 应用了浏览器底层的字体平滑属性（Font Smoothing）*/}
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
