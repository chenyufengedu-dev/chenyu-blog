// src/app/not-found.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// 纯服务端组件：没有任何 state / 事件，不需要 "use client"
export default function NotFound() {
  return (
    // relative + overflow-hidden：让绝对定位的点阵背景被裁在这一屏内
    // min-h-[70vh]：不撑满整屏，给 Navbar / Footer 留出呼吸空间，避免页面过空
    <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-6">
      {/* ── 点阵背景：直接复用首页 Hero 的两套 radial-gradient ── */}
      {/* 浅色：深色点；pointer-events-none 让它纯装饰、不拦截鼠标 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* 深色：浅色点 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── 装饰性大数字 404 ── */}
      {/* select-none + leading-none：禁止选中、剥离行高留白，让数字更紧凑
          text-border：用极淡的边框色，使其退到背景层，不与下方文字争夺注意力 */}
      <span
        aria-hidden
        className="relative z-10 select-none font-black leading-none tracking-tighter text-border"
        style={{ fontSize: "clamp(120px, 22vw, 200px)" }}
      >
        404
      </span>

      {/* ── 信息层：副标题 + 一句话 + 返回链接 ── */}
      <div className="relative z-10 -mt-2 flex flex-col items-center text-center">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
          这里什么都没有
          <span className="ml-1 inline-block origin-bottom-left -translate-y-0.5 rotate-[6deg] animate-[wiggle_1.8s_ease-in-out_infinite] text-accent">
            !!!
          </span>
        </h1>

        <p className="mt-3 text-[14px] text-text-muted">
          页面走丢了，或者它压根没存在过。
        </p>

        {/* group：让链接整体成为 hover 感应区，驱动内部箭头位移 
        transition-transform:触发硬件加速*/}
        <Link
          href="/"
          className="group mt-8 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-bg-subtle/60 hover:text-accent"
        >
          <ArrowLeft
            size={15}
            className="transition-transform group-hover:-translate-x-1"
          />
          回到首页
        </Link>
      </div>
    </section>
  );
}
