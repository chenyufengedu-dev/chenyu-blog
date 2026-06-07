// src/app/now/page.tsx
import type { Metadata } from "next";
import { ArrowUpRight, ChevronDown } from "lucide-react";

export const metadata: Metadata = {
  title: "Now | Chenyu",
  description: "记录我此刻的关注点与正在做的事。",
};

const CHANGELOG = [
  {
    date: "2026 年 06 月",
    text: "上线个人博客 v2，完成 About / Now 页面设计系统重构。",
  },
  {
    date: "2026 年 04 月",
    text: "提交 PreSarco 工具相关学术手稿；开始规划个人技术博客架构。",
  },
  {
    date: "2026 年 03 月",
    text: "参与 Datawhale 社区技术交流；探索 n8n 工作流自动化。",
  },
];

export default function NowPage() {
  const startDate = new Date("2026-03-01");
  const today = new Date();
  const days = Math.ceil(
    Math.abs(today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-24">
      {/* ── HERO：天数为主角 ── */}
      <header className="mb-12 border-b border-border pb-10">
        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
          Now
        </p>
        {/* 默认态（手机端：垂直引力）：引擎只读取 flex flex-col gap-4 
        触发态（桌面端：水平张力）：sm:flex-row：强行把两块内容拉平到同一水平线上。 sm:justify-between sm:items-end (底部引力 / 地板线对齐)：让大数字和右边的标签组底部对齐111111111111111111111
        
        在排版学（Typography）中，字号越大，字符之间默认的间距在视觉上会显得越松散、漏风。给这种超大标题加上极其微量的负间距，能把数字和字母物理压紧
        */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {/* items-baseline:强制所有文字的“物理底座”死死贴在这条基线上 
            leading-none:剥离文字默认呼吸区)*/}
            <div className="flex items-baseline gap-3">
              <span
                className="font-semibold leading-none tracking-[-0.04em] text-text-primary"
                style={{ fontSize: "clamp(52px, 9vw, 80px)" }}
              >
                {days}
              </span>
              <span className="text-[20px] font-light text-text-secondary">
                天
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[12px] tracking-wide text-text-muted">
              自 2026.03.01 持续记录中
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            {/* flex-col（垂直方向排列） 整个物理坐标系就旋转了 90 度  items-start 已经不再代表“靠上”，而是代表“靠左（左对齐）”；而 sm:items-end 则代表“靠右（右对齐）” */}
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-border
                             bg-bg-subtle px-2.5 py-1 font-mono text-[11px] text-text-muted"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c] opacity-70" />
              最后更新于 2026 年 6 月
            </span>
            <a
              href="https://nownownow.com/about"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-0.5 text-[12px] text-text-subtle transition-colors hover:text-text-secondary"
            >
              什么是 Now 页面？
              <ArrowUpRight
                size={11}
                className="-ml-[3px] opacity-0 transition-opacity group-hover:opacity-60"
              />
            </a>
          </div>
        </div>

        <p
          className="text-[15px] leading-[1.75] text-text-secondary"
          style={{ maxWidth: "48ch" }}
        >
          这个页面记录了我
          <strong className="font-medium text-text-primary">最近几个月</strong>
          正在专注的事情。 这不仅是给访客看的，更是对我自身精力分配的锚点约束。
        </p>
      </header>

      {/* ── 正文：三节 ── */}
      <article className="mb-16 space-y-10">
        {/* Research */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Research
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-text-primary">
            临床研究与数据分析
          </h2>
          <p className="text-[14.5px] leading-[1.85] text-text-secondary">
            日常的大部分精力投入在临床营养相关的科研工作中。正在利用 R 和 Python
            处理空间转录组数据， 通过编写自动化的分析 Pipeline
            来提升多样本比对的效率。同时，近期刚完成 PreSarco
            个性化预测工具的学术手稿并提交至期刊，正在跟进后续的审稿流程。
          </p>
        </div>

        {/* Building */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Building
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-text-primary">
            独立开发与技术探索
          </h2>
          <p className="text-[14.5px] leading-[1.85] text-text-secondary">
            在科研之外，正在深入全栈开发领域。除了维护自动化部署和安全更新的
            Docker 容器，
            最近的核心项目就是从零构建你现在看到的这个个人博客。通过实战 Next.js
            15 和 Tailwind CSS，试图用代码来具象化我对设计规范和工程化的理解。
          </p>
        </div>

        {/* Reading */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Reading
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-text-primary">
            正在阅读
          </h2>
          <p className="text-[14.5px] leading-[1.85] text-text-secondary">
            近期在阅读赫胥黎的《美丽新世界》。
          </p>
        </div>
      </article>

      {/* ── CHANGELOG ── */}
      <details className="group border-t border-border pt-7">
        <summary
          className="group/summary flex cursor-pointer list-none items-center gap-3
             py-1 [&::-webkit-details-marker]:hidden"
        >
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Changelog
          </span>

          <div className="h-px flex-1 bg-border transition-colors group-hover/summary:bg-text-subtle/40" />

          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle transition-colors group-hover/summary:text-text-muted group-open:text-text-muted">
            History
            <ChevronDown
              size={13}
              strokeWidth={1.5}
              className="transition-transform duration-200 group-open:rotate-180"
            />
          </span>
        </summary>

        <div className="relative ml-3 mt-7 space-y-1 border-l border-border">
          {CHANGELOG.map((entry, i) => (
            <div
              key={i}
              className="group/item relative -ml-[1px] rounded-r-xl py-3.5 pl-7
                   transition-colors duration-150 hover:bg-bg-subtle/60"
            >
              <div
                className="absolute -left-[5px] top-[19px] h-2.5 w-2.5 rounded-full
                     bg-border ring-4 ring-background transition-all duration-300
                     group-hover/item:scale-110 group-hover/item:bg-[#ea580c]"
              />

              <time className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-text-muted">
                {entry.date}
              </time>

              <p className="text-[14px] leading-[1.75] text-text-secondary">
                {entry.text}
              </p>
            </div>
          ))}

          <div className="pb-1 pl-7 pt-2">
            <p className="text-[13px] italic text-text-subtle">……还在续写。</p>
          </div>
        </div>
      </details>
    </div>
  );
}
