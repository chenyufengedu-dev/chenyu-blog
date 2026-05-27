// src/app/about/page.tsx
import type { Metadata } from "next";
import { Clock, Mail, MapPin, Microscope, Terminal } from "lucide-react";
import { FaGithub, FaTwitter } from "react-icons/fa";
import ContactForm from "@/components/contact/contact-form";

//  SEO 元数据
export const metadata: Metadata = {
  title: "关于 | Chenyu",
  description: "关于我的背景、技能与经历",
};

// 配置驱动的数据中心
const STATS = [
  { num: "3", label: "开源项目" },
  { num: "2+", label: "年研究" },
  { num: "1", label: "篇评审" },
];

const SKILLS = [
  {
    en: "Research",
    items: ["空间转录组", "单细胞分析", "Python", "R"],
  },
  {
    en: "Frontend",
    items: ["Next.js", "React", "TypeScript", "Tailwind"],
  },
  { en: "Tooling", items: ["Docker", "Git", "Linux", "CI/CD"] },
];
const TIMELINE_DATA = [
  {
    date: "2026.03 - Present",
    title: "开源生态与社区共建",
    description:
      "深入参与 Datawhale 社区探讨教育出版合作。在 GitHub 独立管理 TrendRadar_docker 容器化项目，并探索 Hugging Face 在工作流中的工程落地。",
  },
  {
    date: "2025.10",
    title: "计算架构演进",
    description:
      "接入 Intelligent Computing Center 计算中心，为高通量生物数据分析搭建底层算力体系。",
  },
  {
    date: "2025.04",
    title: "学术研究流转",
    description:
      "完成 The American Journal of Clinical Nutrition 期刊稿件 (AJCN-D-24-02427) 的同行评审通讯与决策流转。",
  },
];
const NOW_ITEMS = [
  {
    title: "研究",
    text: "空间转录组数据分析与高通量生物数据工作流。",
  },
  {
    title: "工程",
    text: "Next.js 应用、容器化部署与可复用的前端设计系统。",
  },
  {
    title: "写作",
    text: "记录生信研究、Web 工程和 AI 辅助学习的阶段性思考。",
  },
];
const CONTACTS = [
  {
    href: "mailto:your.email@example.com",
    icon: <Mail size={13} />,
    label: "your.email@example.com",
  },
  {
    href: "https://github.com/yourusername",
    icon: <FaGithub size={13} />,
    label: "github.com/yourusername",
    external: true,
  },
  {
    href: "https://twitter.com/yourusername",
    icon: <FaTwitter size={13} />,
    label: "@yourusername",
    external: true,
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-2 py-13 md:px-2 md:py-18">
      {/* 模块 1：Hero 首屏自我介绍 */}
      <section className="relative mb-14 overflow-visible">
        {/* 1. 环境光晕 (Ambient Glow) 
        pointer-events-none（事件穿透）: 物理层面上变成了一个“幽灵”。用户的鼠标点击、滑动会直接穿透它
        absolute left-[-380px] top-[-215px]（绝对坐标定位）
        h-[540px] w-[1300px]：定义了这个发光体的巨大物理尺寸
        dark:hidden（条件渲染）深色模式取消这个光晕

        style (原生 CSS 视觉引擎)
        background: "radial-gradient(...)" (径向渐变)
        ellipse at 42% 50%：设定渐变的中心点坐标（X轴 42%，Y轴 50%）
        rgba(...) 0%, ... transparent 78%：这是颜色断点
        filter: "blur(18px)" (高斯模糊)
        zIndex: 0 (深度层级)：被死死按在网页的最底面*/}
        {/* ============ Light Mode 光晕（dark:hidden）============ */}

        {/* Light 第一层：大范围外晕，周期 4s，基准节拍 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[-380px] top-[-215px] h-[540px] w-[1300px] dark:hidden"
          style={{
            background:
              "radial-gradient(ellipse at 42% 50%, rgba(234,88,12,0.16) 0%, rgba(251,146,60,0.105) 24%, rgba(255,237,213,0.055) 50%, transparent 78%)",
            filter: "blur(18px)",
            zIndex: 0,
            willChange: "opacity",
            animationName: "glow-breathe",
            animationDuration: "4s",
            animationTimingFunction: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: "0s",
          }}
        />

        {/* Light 第二层：中范围橙晕，周期 3.1s，与 4s 互质，永不同步 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[-150px] top-[-58px] h-[280px] w-[720px] dark:hidden"
          style={{
            background:
              "radial-gradient(ellipse at 46% 58%, rgba(251,146,60,0.13) 0%, rgba(251,146,60,0.06) 42%, transparent 76%)",
            filter: "blur(22px)",
            zIndex: 0,
            willChange: "opacity",
            animationName: "glow-breathe",
            animationDuration: "5.5s",
            animationTimingFunction: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: "-1.8s",
          }}
        />

        {/* Light 第三层：内核热晕，周期 3.7s，三层形成随机相位差 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[30px] top-[-10px] h-[170px] w-[430px] dark:hidden"
          style={{
            background:
              "radial-gradient(ellipse at 44% 58%, rgba(234,88,12,0.08) 0%, rgba(251,146,60,0.038) 52%, transparent 78%)",
            filter: "blur(20px)",
            zIndex: 0,
            willChange: "opacity",
            animationName: "glow-breathe-core",
            animationDuration: "3.2s",
            animationTimingFunction: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: "-0.9s",
          }}
        />

        {/* ============ Dark Mode 光晕（dark:block）============ */}

        {/* Dark 第一层：琥珀暖光，提高 GB 分量 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[-300px] top-[-108px] hidden h-[430px] w-[1080px] dark:block"
          style={{
            background:
              "radial-gradient(ellipse at 43% 50%, rgba(255,130,30,0.28) 0%, rgba(255,100,20,0.12) 30%, transparent 62%)",
            filter: "blur(55px)",
            mixBlendMode: "screen",
            willChange: "opacity",
            zIndex: 0,
            animationName: "glow-breathe",
            animationDuration: "4s",
            animationTimingFunction: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: "0s",
          }}
        />

        {/* Dark 第二层 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[-70px] top-[-18px] hidden h-[210px] w-[560px] dark:block"
          style={{
            background:
              "radial-gradient(ellipse at 44% 56%, rgba(255,140,40,0.22) 0%, rgba(255,100,20,0.08) 40%, transparent 70%)",
            filter: "blur(35px)",
            mixBlendMode: "screen",
            willChange: "opacity",
            zIndex: 0,
            animationName: "glow-breathe",
            animationDuration: "5.5s",
            animationTimingFunction: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: "-1.8s",
          }}
        />

        {/* Dark 第三层：高亮核心点，让标题字附近有聚焦感 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[20px] top-[-5px] hidden h-[140px] w-[380px] dark:block"
          style={{
            background:
              "radial-gradient(ellipse at 44% 58%, rgba(255,160,60,0.18) 0%, rgba(255,120,30,0.06) 50%, transparent 75%)",
            filter: "blur(18px)",
            mixBlendMode: "screen",
            willChange: "opacity",
            zIndex: 0,
            animationName: "glow-breathe-core",
            animationDuration: "3.2s",
            animationTimingFunction: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: "-0.9s",
          }}
        />

        {/* 2. 核心文本区 (保证 z-10 悬浮在光晕之上) 
        leading-[1.0]（行高压缩）：
        tracking-[-0.03em]（字偶距收缩）
        clamp(52px, 8vw, 80px)
        52px（底线）：当用户在极窄的手机屏幕（比如 iPhone SE）上观看时，字号绝对不会缩小到 52 像素以下，保证标题的绝对醒目。
        8vw（弹性缩放）：vw 代表 Viewport Width（视口宽度）。8vw 意思是“永远保持屏幕宽度的 8%”。随着用户拉伸浏览器窗口，字号会像弹簧一样跟着平滑变大。
        80px（天花板）：当用户在 32 寸带鱼屏显示器上打开网页时，字号一旦触碰到 80 像素就会死死锁住，绝对不会继续放大变成极其夸张的巨型文字。*/}
        <h1
          className="relative z-10 font-semibold leading-[1.0] tracking-[-0.03em] text-text-primary"
          style={{ fontSize: "clamp(52px, 8vw, 80px)" }}
        >
          Chenyu<span className="text-[#ea580c]">.</span>
        </h1>

        {/* 批量控制容器内部子元素垂直间距的排版指令 */}
        <div className="relative z-10 mt-4 space-y-0.5">
          <p className="text-[17px] font-normal leading-[1.55] tracking-tight text-text-primary sm:text-[18px]">
            在生命科学与代码工程的交汇处，
          </p>
          <p className="text-[17px] font-normal leading-[1.55] tracking-tight text-text-secondary sm:text-[18px]">
            构建优雅的数字秩序。
          </p>
          <p className="pt-2 text-[14px] leading-[1.7] text-text-muted">
            记录生信研究、Web 工程与长期学习的过程。
          </p>
        </div>

        {/* 统计数据栏 */}
        <div className="relative z-10 mt-4 flex gap-12">
          {STATS.map(({ num, label }) => (
            <div key={label} className="flex flex-col gap-0.3">
              <span className="font-mono text-[22px] font-semibold tracking-tight text-[#ea580c]">
                {num}
              </span>
              <span className="text-[12px] text-text-subtle">{label}</span>
            </div>
          ))}
        </div>

        {/* 分割线 */}
        <div className="relative z-10 mb-3 mt-3 h-[1px] bg-border" />

        {/* 角色标签组
        flex-wrap (自动折行)
        items-center (交叉轴居中) 让所有元素在垂直方向的几何中心线上绝对对齐
        gap-x-5 (水平缝隙)：在横向排列的元素之间，硬性插入固定的水平间距。Tailwind 中 1 个单位是 4px，所以这里是 20px。
        gap-y-3 (垂直缝隙)：当元素因为 flex-wrap 折行到第二排时，第一排和第二排之间硬性插入 12px 的上下间距。
        select-none 禁止用户用鼠标或手指长按选中该元素*/}
        <div className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-text-subtle">角色</span>
            <span className="text-[15px] font-medium text-text-primary">
              研究生 · 生物信息
            </span>
          </div>
          <span className="select-none text-lg font-light text-border">/</span>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-text-subtle">专注</span>
            <span className="text-[15px] font-medium text-text-primary">
              空间转录组 · Web 工程
            </span>
          </div>
          <span className="select-none text-lg font-light text-border">/</span>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-text-subtle">技术栈</span>
            <span className="text-[15px] font-medium text-text-primary">
              Python · Next.js
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              {/* animate-ping 雷达波动画 在 1 秒钟内，将这个圆点的体积放大到原来的 2 倍（transform: scale(2)），同时将透明度从 60% 逐渐降到 0%（完全透明消失） */}
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
            <span className="font-mono text-[12px] text-text-muted">
              Available for internship
            </span>
          </div>
        </div>
      </section>

      {/* 模块 2：About 关于模块 */}
      <section className="mb-12">
        {/* About+分割线 
        whitespace-nowrap文本强制单行锁 */}
        <div className="mb-3 flex items-center gap-4">
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle">
            About
          </span>
          <div className="h-[1px] flex-1 bg-border" />
        </div>
        {/* 两部分About内容 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* 生信研究 
          space-y-2.5 子元素之间的垂直缝隙*/}
          <div className="group space-y-2.5 border-l-2 border-border/50 pl-4 transition-colors duration-200 hover:border-[#ea580c]">
            <div className="flex items-center gap-2">
              <Microscope size={14} className="shrink-0 text-[#ea580c]" />
              <span className="text-[14.5px] font-medium text-text-primary">
                生信研究
              </span>
            </div>
            <p className="text-[14.5px] leading-[1.8] text-text-secondary">
              目前作为研究生，专注于空间转录组数据分析。致力于从海量的生物序列中提取特征，寻找生命的底层模式与规律。
            </p>
          </div>
          <div className="group space-y-2.5 border-l-2 border-border/50 pl-4 transition-colors duration-200 hover:border-[#ea580c]">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="shrink-0 text-[#ea580c]" />
              <span className="text-[14.5px] font-medium text-text-primary">
                全栈开发
              </span>
            </div>
            <p className="text-[14.5px] leading-[1.8] text-text-secondary">
              痴迷于现代 Web 技术的美感与秩序。享受用 Next.js
              和严谨的设计系统，将复杂数据转化为极简、高效的用户体验。
            </p>
          </div>
        </div>
      </section>

      {/* Toolkit 技能胶囊标签 */}
      <section className="mb-12">
        <div className="mb-3 flex items-center gap-4">
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle">
            Toolkit
          </span>
          <div className="h-[1px] flex-1 bg-border" />
        </div>

        {/* items-baseline（排版校准基线） 底部画了一条无形的英文书写线（四线格的第三条线）。无论两边的字体大小相差多少，强行让所有字体的底部贴在这条线上
        px-2（水平内边距 8px）：把盒子内部的文字往里推 8px，给背景色留出呼吸空间。
        -mx-2（负水平外边距 -8px）：强行把这个盒子的物理边界往左和往右各扯出 8px，进入旁边的虚空地带*/}
        <div>
          {SKILLS.map(({ en, items }, i) => (
            <div
              key={en}
              className={`group flex items-baseline gap-5 rounded-lg px-2 py-3.5 -mx-2 transition-colors duration-150 hover:bg-bg-subtle/60 ${
                i < SKILLS.length - 1 ? "border-b border-border/40" : ""
              }`}
            >
              {/* shrink-0 (禁止压缩)：让英文标签保持固定宽度，不会因为内容多少而变形 */}
              <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-text-subtle transition-colors duration-150 group-hover:text-[#ea580c]">
                {en}
              </span>
              {/* mx-2.5 (双向隔离带) margin-left: 10px; margin-right: 10px; 
              select-none (数据防污染) 操作系统在框选文本时会直接无视这个元素，剪贴板里只会保留干净的文字*/}
              <div className="flex flex-wrap gap-1.5 text-[14px] leading-none text-text-primary">
                {items.map((item, j) => (
                  <span key={item}>
                    <span className="inline-flex items-center rounded-md border border-border/60 bg-bg-subtle px-2.5 py-1 text-[12px] text-text-secondary transition-colors duration-150 hover:border-[#ea580c]/30 hover:text-[#ea580c]">
                      {item}
                    </span>
                    {j < items.length - 1 && (
                      <span className="mx-2.5 select-none text-border/98">
                        ·
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Now 近况 */}
      <section className="mb-12">
        <div className="mb-3 flex items-center gap-4">
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle">
            Now
          </span>
          <div className="h-[1px] flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
          {NOW_ITEMS.map((item, index) => (
            <div
              key={item.title}
              className="space-y-1.5 border-l-2 border-[#ea580c]/25 pl-3 transition-colors duration-200 hover:border-[#ea580c]/70"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[12px] text-[#ea580c]/60">
                  0{index + 1}
                </span>
                <h4 className="text-[14px] font-medium text-text-primary">
                  {item.title}
                </h4>
              </div>
              <p className="text-[13.5px] leading-[1.75] text-text-secondary">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline 时间轴 */}
      <section className="mb-12">
        <div className="mb-4 flex items-center gap-4">
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle">
            Timeline
          </span>
          <div className="h-[1px] flex-1 bg-border" />
        </div>

        <div className="relative ml-3 space-y-1 border-l border-border">
          {TIMELINE_DATA.map((item, index) => (
            <div
              key={index}
              className="group relative -ml-[1px] rounded-r-xl py-3 pl-8 transition-colors duration-200 hover:bg-bg-subtle/60"
            >
              {/* 锚点小圆圈：利用负的 margin-left 卡在边框线上 
              group-hover:scale-110：因为外层卡片加了 group（雷达感应区）。只要用户的鼠标进入了这整条文字经历的区域，这个小圆圈就会立刻响应，在物理体积上放大 10%（scale(1.1)*/}
              {/*
                dot-timeline 类配合 globals.css 中的规则实现 hover 呼吸效果：
                  常态：bg-border 灰色，无动画
                  .group:hover .dot-timeline → bg-[#ea580c] + dot-glow 动画
              */}
              <div className="dot-timeline absolute -left-[5px] top-[22px] h-2.5 w-2.5 rounded-full bg-border ring-4 ring-background transition-colors duration-300" />
              <div className="flex flex-col gap-1.5">
                {/* inline-flex (内联弹性引擎)对外部（对外社交）：它表现得像一个普通的文本字母（inline）。它不会像普通的 div 或者 flex 那样霸道地强行占据整整一行，而是可以和其他文字并排挨着。
                对内部（内部管理）：它又是一个强大的弹性盒子（flex）。这意味着哪怕这个标签里只有一个词，或者以后你想在日期旁边加一个小日历图标，你都可以用 Flexbox 的能力（比如 items-center、gap）去极其精准地控制内部元素的对齐，而不会出现文字和图标高低不平的现象。 
                w-fit 里面的字有多宽，我的盒子就只撑到多宽（加上内边距）*/}
                <time className="inline-flex w-fit rounded border border-border/50 bg-bg-subtle px-2.5 py-[3px] font-mono text-[11px] uppercase tracking-widest text-text-subtle">
                  {item.date}
                </time>
                <h4 className="text-[15.5px] font-medium text-text-primary transition-colors duration-200 group-hover:text-accent">
                  {item.title}
                </h4>
                <p className="text-[14px] leading-[1.75] text-text-secondary">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
          <div className="pb-1 pl-8 pt-2">
            <p className="text-[13.5px] italic text-text-subtle">
              ……故事还在续写。
            </p>
          </div>
        </div>
      </section>

      {/* Contact 联系方式 */}
      <section>
        <div className="mb-5 flex items-center gap-4">
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle">
            Contact
          </span>
          <div className="h-[1px] flex-1 bg-border" />
        </div>

        {/* items-start（顶部对齐死线）：
          md:grid-cols-[0.88fr_1.12fr] 给左边的文字区分配 0.88 份，给右边的表单区分配 1.12 份。*/}
        <div className="grid grid-cols-1 gap-9 md:grid-cols-[0.96fr_1.04fr] md:gap-12">
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="mb-2 text-[17px] font-semibold text-text-primary">
                随时欢迎来信
              </h3>
              <p className="text-[14px] leading-[1.8] text-text-secondary">
                无论是空间转录组的学术探讨、Next.js 技术交流，还是全职 /
                实习机会，我都会认真回复。
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-bg-subtle/60 px-4 py-2.5">
              <div className="flex items-center gap-3 py-2.5">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                </span>
                <span className="text-[13.5px] font-medium text-text-primary">
                  欢迎交流与合作
                </span>
              </div>
              <div className="flex items-center gap-3 py-2.5 text-[13px] text-text-secondary">
                <Clock size={12} className="shrink-0 text-text-subtle" />
                <span>通常在 24 小时内回复</span>
              </div>
              <div className="flex items-center gap-3 py-2.5 text-[13px] text-text-secondary">
                <MapPin size={12} className="shrink-0 text-text-subtle" />
                <span>中国大陆 · 可远程</span>
              </div>
            </div>

            <div className="space-y-1">
              {CONTACTS.map(({ href, icon, label, external }) => (
                <a
                  key={label}
                  href={href}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="group -mx-2.5 flex items-center gap-3 rounded-lg px-2.5 py-1 text-[13.5px] text-text-secondary transition-colors duration-150 hover:bg-bg-subtle hover:text-text-primary"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-text-subtle transition-colors duration-150 group-hover:border-[#ea580c]/25 group-hover:text-[#ea580c]">
                    {icon}
                  </span>
                  {/* "truncate" (底层物理截断引擎) 
                  white-space: nowrap; (锁死单行)
                  overflow: hidden; (物理切割) 超出部分的像素立刻被隐藏（裁切掉）
                  text-overflow: ellipsis; (视觉补偿) 文字超出时显示为...（省略号）*/}
                  <span className="truncate">{label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* 调用表单组件*/}
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
