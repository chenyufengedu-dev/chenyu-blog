"use client";
import { motion, type Transition } from "framer-motion";
import { useEffect, useRef } from "react";

// 💡 调节指南：顶层散落词的分布
// x 和 y 使用百分比，这样能自适应不同屏幕大小。若想增加词汇，直接在这里添加即可。
const FLOATING_WORDS = [
  { text: "生信", x: "12%", y: "22%" },
  { text: "研究", x: "78%", y: "18%" },
  { text: "代码", x: "85%", y: "55%" },
  { text: "探索", x: "15%", y: "65%" },
  { text: "前端", x: "70%", y: "75%" },
  { text: "写作", x: "30%", y: "80%" },
  { text: "数据", x: "55%", y: "15%" },
  { text: "分析", x: "20%", y: "45%" },
];

// 💡 调节指南：核心交互物理参数
const LERP_SPEED = 0.17; // 鼠标跟随的“粘性/延迟感”。范围 0.01-1。越小越迟钝（像在水里），越大越跟手。
const CIRCLE_R = 200; // 探照灯（圆圈）的半径大小。想要透视区域更大可增加至 250 或 300。
const MAX_ROTATE = 15; // 3D 偏转的最大角度（度数）。值越大，鼠标移到屏幕边缘时文字倾斜越剧烈。
const PERSPECTIVE = 700; // 3D 透视视距。值越小，3D 畸变越夸张；值越大（如 1000），倾斜显得越平缓自然。

// 💡 调节指南：标题入场动画参数
// ease 使用贝塞尔曲线，让动画前段快、后段慢，像轻轻停住，而不是机械匀速移动。
const TITLE_INTRO_TRANSITION = {
  duration: 0.8,
  ease: [0.16, 1, 0.3, 1],
  delay: 0.2,
} satisfies Transition;

export default function HomeHero() {
  const heroRef = useRef<HTMLElement>(null);

  // 初始值放在 Hero 中心附近，避免页面刚加载时标题被屏幕外坐标拉歪。
  // 真正的鼠标位置会在第一次 mousemove 时接管。
  const mouseTarget = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const rafId = useRef<number>(0);

  const darkLayerRef = useRef<HTMLDivElement>(null);
  const lightTitleRef = useRef<HTMLDivElement>(null);
  const darkTitleRef = useRef<HTMLDivElement>(null);

  // 用 ref 记录鼠标是否真正进入过 Hero。
  // 这里不用 state，是为了避免鼠标第一次移动时触发 React 重渲染，导致 RAF 被重启。
  const hasPointerEnteredRef = useRef(false);

  useEffect(() => {
    const heroElement = heroRef.current;
    if (!heroElement) return;

    const rect = heroElement.getBoundingClientRect();
    const center = {
      x: rect.width / 2,
      y: rect.height / 2,
    };

    // 关键修复：
    // RAF 从组件挂载后就启动，不再等待 Framer Motion 入场动画结束。
    // 但启动时先把坐标放在 Hero 中心，标题默认保持端正。
    mouseTarget.current = center;
    current.current = center;

    const onMove = (e: MouseEvent) => {
      const nextRect = heroElement.getBoundingClientRect();

      // 关键修复：
      // clip-path 的坐标是相对于 Hero 容器自己的坐标，
      // 所以要减去 Hero 当前在视口中的 left/top，得到“鼠标在 Hero 内部的位置”。
      const nextPosition = {
        x: e.clientX - nextRect.left,
        y: e.clientY - nextRect.top,
      };

      // 第一次捕获到鼠标位置时，直接同步 current 和 target。
      // 否则 current 会从中心点慢慢追到真实鼠标位置，视觉上会出现撕裂和卡顿。
      if (!hasPointerEnteredRef.current) {
        hasPointerEnteredRef.current = true;
        current.current = nextPosition;
      }

      mouseTarget.current = nextPosition;
    };

    // 只监听 Hero 容器内部的鼠标移动。
    // 鼠标滚到下面内容区后，不会再驱动上方探照灯移动。
    heroElement.addEventListener("mousemove", onMove);

    const tick = () => {
      // 线性插值算法：当前坐标持续逼近目标坐标
      current.current.x +=
        (mouseTarget.current.x - current.current.x) * LERP_SPEED;
      current.current.y +=
        (mouseTarget.current.y - current.current.y) * LERP_SPEED;

      const cx = current.current.x;
      const cy = current.current.y;

      // 1. 更新遮罩层的位置
      if (darkLayerRef.current) {
        // 只有当鼠标真正进入 Hero 后，圆圈才会展开为 CIRCLE_R 大小。
        // 这样页面刚加载时不会凭空出现一个探照灯圆圈。
        const r = hasPointerEnteredRef.current ? CIRCLE_R : 0;
        darkLayerRef.current.style.clipPath = `circle(${r}px at ${cx}px ${cy}px)`;
      }

      // 2. 计算 3D 偏转参数
      const latestRect = heroElement.getBoundingClientRect();
      const vw = latestRect.width;
      const vh = latestRect.height;

      // 将鼠标坐标归一化到 [-1, 1] 的范围（Hero 中心为 0,0）
      const nx = (cx - vw / 2) / (vw / 2);
      const ny = (cy - vh / 2) / (vh / 2);

      // x 轴位移影响 Y 轴旋转，y 轴位移影响 X 轴旋转（注意正负号决定了倾斜方向是迎合鼠标还是躲避鼠标）
      const rotateY = nx * MAX_ROTATE;
      const rotateX = -ny * MAX_ROTATE;
      const transform3D = `perspective(${PERSPECTIVE}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      // 同步应用 3D 变换到两层标题，保证视差一致性
      if (lightTitleRef.current)
        lightTitleRef.current.style.transform = transform3D;
      if (darkTitleRef.current)
        darkTitleRef.current.style.transform = transform3D;

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      heroElement.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    // cursor-none 隐藏了系统鼠标，完全靠交互引导
    // 注意：这里用 section，不用 main。因为 src/app/page.tsx 外层已经有一个 main。
    <section
      ref={heroRef}
      className="relative min-h-screen w-full overflow-hidden cursor-none select-none"
    >
      {/* ── 底层世界 ── */}
      <div
        className="absolute inset-0 flex items-center justify-center bg-white dark:bg-[#0a0a0a]"
        style={{ perspective: `${PERSPECTIVE}px` }}
      >
        {/* 💡 调节指南：底层点阵的颜色与透明度（rgba） */}
        <div
          className="absolute inset-0 pointer-events-none dark:hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)",
            backgroundSize: "28px 28px", // 调整点与点之间的疏密
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none hidden dark:block"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* motion.div 只负责入场动画；内部 div 才负责 3D 倾斜。
            这样 Framer Motion 和 RAF 不会同时修改同一个元素的 transform。
            RAF 从一开始就运行，因此入场动画结束后不会再出现控制权切换的停顿。 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TITLE_INTRO_TRANSITION}
        >
          <div
            ref={lightTitleRef}
            className="text-center"
            // will-change 提示浏览器开启 GPU 硬件加速，防止动画掉帧
            style={{ willChange: "transform", transformStyle: "preserve-3d" }}
          >
            {/* 💡 调节指南：底层主标题排版 */}
            <h1
              className="leading-[1.0] tracking-[-0.03em]"
              style={{ fontSize: "clamp(44px, 7vw, 96px)" }} // clamp 确保在手机上不换行，大屏上够震撼
            >
              <span className="font-black text-[#111827] dark:text-[#f5f5f5]">
                HELLO, I&apos;M{" "}
              </span>
              <span
                className="font-extralight italic text-[#111827] dark:text-[#f5f5f5]"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }} // 衬线体强化对比度
              >
                Chenyu
              </span>
            </h1>
            <p className="mt-5 text-[14px] tracking-[0.06em] text-[#9ca3af] dark:text-[#6b7280]">
              生物信息学研究生 / 空间转录组分析 / 前端开发学习中
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── 顶层世界（遮罩层） ── */}
      <div
        ref={darkLayerRef}
        // 背景色即为“探照灯”打上去的底色
        className="absolute inset-0 flex items-center justify-center bg-[#111111] dark:bg-white"
        style={{
          clipPath: "circle(0px at -600px -600px)", // 初始将其藏在屏幕左上角之外
          willChange: "clip-path",
          perspective: `${PERSPECTIVE}px`,
        }}
      >
        {/* 💡 调节指南：顶层（圆圈内）的点阵 */}
        <div
          className="absolute inset-0 pointer-events-none dark:hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none hidden dark:block"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* 💡 调节指南：散落词的样式调整 */}
        {FLOATING_WORDS.map((w) => (
          <span
            key={w.text}
            // text-white/50 中的 50 控制了透明度，你可以改为 /30 让其更幽暗，或 /80 让其更清晰
            className="absolute text-[13px] font-medium tracking-[0.15em] text-white/50 dark:text-black/30"
            style={{ left: w.x, top: w.y }}
          >
            {w.text}
          </span>
        ))}

        {/* 顶层标题和底层标题使用完全相同的入场参数，保证两层视觉上重合。 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TITLE_INTRO_TRANSITION}
        >
          <div
            ref={darkTitleRef}
            className="text-center"
            style={{ willChange: "transform", transformStyle: "preserve-3d" }}
          >
            {/* 💡 调节指南：顶层主标题排版 */}
            <h1
              className="leading-[1.0] tracking-[-0.03em]"
              style={{ fontSize: "clamp(44px, 7vw, 96px)" }}
            >
              <span className="font-black text-white dark:text-[#111827]">
                你好，我是{" "}
              </span>
              <span
                // Chenyu 使用了你的专属品牌色 #ea580c，作为视觉锚点贯穿始终
                className="font-extralight italic text-[#ea580c]"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
              >
                Chenyu
              </span>
            </h1>
            <p className="mt-5 text-[14px] tracking-[0.06em] text-white/40 dark:text-[#6b7280]">
              生物信息学研究生 / 空间转录组分析 / 前端开发学习中
            </p>
          </div>
        </motion.div>
      </div>

      {/* 底部提示 */}
      <div className="absolute bottom-8 left-0 w-full text-center pointer-events-none z-20">
        <p className="text-[11px] tracking-[0.1em] text-[#9ca3af]">
          移动鼠标开启探索 · 向下滚动查看更多
        </p>
      </div>
    </section>
  );
}
