"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import ThemeToggle from "../theme-toggle";

const navLinks = [
  { href: "/blog", label: "博客" },
  { href: "/projects", label: "项目" },
  { href: "/about", label: "关于" },
  { href: "/now", label: "Now" },
];

// setIsOpen 被调用后，React 会立刻重新运行一次这个 Navbar 函数

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    // sticky（粘性定位）当你往下滚动网页时，它不会跟着滚走，而是“粘”在屏幕视野里。
    // top-0 死死地粘在屏幕的最顶端（距离顶部 0 像素的位置）
    // z-50 确保它在其他元素之上显示（层级很高）
    // backdrop-blur-md = blur(12px) （中度磨砂)
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/80 backdrop-blur-md transition-colors dark:border-white/[0.06] dark:bg-[#0a0a0a]/95 dark:backdrop-blur-none">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-8">
        {/* Logo */}
        <Link
          href="/"
          // 加入 duration-300 的平滑过渡，并将 hover 颜色指向 Tailwind 配置好的 accent 变量
          className="text-base font-semibold text-text-primary transition-colors duration-300 hover:text-accent"
        >
          Chenyu
        </Link>

        {/* 桌面端导航 */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative py-1 text-sm font-normal text-text-muted transition-colors hover:text-text-primary"
            >
              {link.label}
              {/* 核心魔法：绝对定位的下划线，宽度初始为 0，hover 时过渡到 100% */}
              <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-accent transition-all duration-200 group-hover:w-full" />
            </Link>
          ))}
          <ThemeToggle />
        </nav>

        {/* 移动端菜单按钮与主题切换 */}
        <div className="flex items-center gap-4 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-text-muted hover:text-text-primary p-1"
            aria-label="打开菜单"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {isOpen && (
        <div className="border-b border-border bg-white px-6 py-4 transition-colors dark:border-white/[0.06] dark:bg-[#0a0a0a] md:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="group relative w-fit py-1 text-sm font-normal text-text-muted transition-colors hover:text-text-primary"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-accent transition-all duration-200 group-hover:w-full" />
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
