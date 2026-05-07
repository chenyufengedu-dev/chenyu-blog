// src/components/layout/page-transition.tsx
"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

// 🏆 终极高级质感：光学对焦 + 深度微缩放 (Scale In + Focus)
const pageVariants = {
  // 初始状态（页面即将载入前）
  initial: {
    opacity: 0,
    scale: 0.98, // 从极深处开始（98% 大小，极度克制）
    filter: "blur(6px)", // 初始处于强失焦状态
  },
  // 激活状态（页面完全展现）
  animate: {
    opacity: 1,
    scale: 1, // 推进到正常的 100% 比例
    filter: "blur(0px)", // 瞬间对焦清晰
  },
  // 退出状态（旧页面即将消失前）
  exit: {
    opacity: 0,
    scale: 1.01, // 退出时不是缩小，而是极其轻微地“放大并消散”（越过镜头）
    filter: "blur(4px)", // 再次失焦
  },
};

const pageTransition = {
  // 缩短时间，配合深度的错觉，让切换极其爽快
  duration: 0.35,
  // 这是一组专为“缩放”调优的自定义阻尼曲线（Ease Out Expo 变体），
  // 它的特点是：起步极其干脆迅猛，但最后 10% 会有一段非常丝滑的减速拖尾。
  ease: [0.16, 1, 0.3, 1] as const,
};

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
        // 由于频繁进行缩放和滤镜计算，必须开启 GPU 硬件加速，防止在低端设备上掉帧卡顿
        className="w-full flex-1 flex flex-col will-change-[opacity,transform,filter]"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
