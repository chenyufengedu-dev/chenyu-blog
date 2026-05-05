// src/app/now/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Now | Chenyu",
  description: "我现在正在做什么",
};

export default function NowPage() {
  return (
    // mx-auto:会让浏览器自动、平均地分配左右两边的空白，从而在物理上把这个容器完美“居中”在屏幕中间。
    // border-b:Border-Bottom（底部边框）。它在底层直接翻译为 border-bottom-width: 1px;。
    <div className="mx-auto max-w-3xl px-6 py-20 md:px-8 md:py-24">
      <header className="mb-12 border-b border-border pb-8">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          Now
        </h1>
        <p className="text-sm text-text-muted font-mono">
          最后更新于：2026年5月
        </p>
      </header>
      {/* prose prose-neutral： 给内部所有的裸露 HTML 标签注入一套经过顶尖设计师调优的、基于灰阶（neutral）的默认阅读样式 
      dark:prose-invert：自动适配暗黑模式。
      max-w-none：解除插件默认的最大宽度限制（默认大约是 65 个字符宽，为了防眼疲劳），让文字可以铺满你的整个容器。
      prose-p:leading-[1.75]：强行把所有 <p>（段落）的行高设为 1.75 倍。
      prose-headings:tracking-tight：强行把所有标题（h1~h6）的字距稍微收紧，显得更干练。
      prose-strong:font-semibold：强行把加粗文本从笨重的纯粗体（bold）降格为半粗体（semibold），让页面看起来更精致。
      <ul> (Unordered List)：无序列表。告诉浏览器：“我下面要列举几件事，它们没有先后顺序”。在浏览器里默认会显示为带圆点（Bullet）的列表。
      <li> (List Item)：列表项。包裹在 <ul> 内部，每一对 <li> 就是列表里的一行。*/}
      <div
        className="prose prose-neutral dark:prose-invert max-w-none 
        prose-p:text-text-secondary prose-p:leading-[1.75]
        prose-headings:text-text-primary prose-headings:font-medium prose-headings:tracking-tight
        prose-li:text-text-secondary
        prose-strong:text-text-primary prose-strong:font-semibold"
      >
        <p>
          这个页面记录了我<strong>最近几个月</strong>
          正在专注的事情。这不仅是给访客看的，更是对我自身精力分配的锚点约束。
        </p>
        <h3>学术与研究</h3>
        <ul>
          <li>
            <strong>空间转录组分析 pipeline 优化</strong>：正在将常规的 Python
            分析脚本容器化，尝试提升多样本比对的运算效率，以适应实验室下半年的高通量数据需求。
          </li>
          <li>
            <strong>论文跟进</strong>：目前在精读 Cell 和 Nature Genetics
            上关于单细胞空间转录组联合分析的最新方法论。
          </li>
        </ul>
        <h3>工程与构建</h3>
        <ul>
          <li>
            <strong>全栈前端体系建立</strong>：正在系统性地学习 Next.js 15 和
            React 19，将之前零散的前端知识点通过构建这个个人数字花园进行串联。
          </li>
          <li>
            <strong>TrendRadar 容器化部署</strong>：利用周末时间维护 TrendRadar
            Docker 项目，目前正探索集成自动化部署与安全更新监控。
          </li>
        </ul>

        <h3>生活与输入</h3>
        <ul>
          <li>
            阅读《设计体系：数字产品设计的系统化方法》，理解原子化设计与前端工程的边界。
          </li>
          <li>尝试建立更稳定的作息循环，增加每周的无氧运动时间。</li>
        </ul>
        <hr className="my-10 border-border" />
        <p className="text-sm text-text-muted italic">
          * 此页面概念来源于{" "}
          <a
            href="https://nownownow.com/about"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Derek Sivers 的 /now 运动
          </a>
          。
        </p>
      </div>
    </div>
  );
}
