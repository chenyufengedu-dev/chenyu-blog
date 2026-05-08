// src/components/layout/page-transition.tsx
"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

export default function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  // 1. 获取当前页面的路由路径（如 "/blog", "/about"）
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        // 将路由绑定为唯一 key
        // 只要网址一变，旧盒子立马销毁（触发 exit），新盒子生成（触发 initial/animate）
        key={pathname}
        className={className}
        // 初始状态：完全透明，向下偏移 6px
        initial={{ opacity: 0, y: 3 }}
        // 动画终点：完全不透明，回到 y: 0
        animate={{ opacity: 1, y: 0 }}
        // 退出状态：完全透明，向上微缩偏移 -4px
        exit={{ opacity: 0, y: -2 }}
        // 动画配置：0.25秒短时长，标准 cubic-bezier 缓动曲线
        transition={{
          duration: 0.25,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
