// src/app/about/page.tsx
import type { Metadata } from "next";
import { Dna, Code2, Wrench, Microscope, Terminal } from "lucide-react";
import { FaGithub, FaTwitter } from "react-icons/fa";
import { Mail } from "lucide-react";
import ContactForm from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "关于 | Chenyu",
  description: "关于我的背景、技能与经历",
};

// 技能数据保持不变
const SKILL_CATEGORIES = [
  {
    title: "生物信息与数据",
    icon: <Dna size={16} className="text-text-muted" />,
    items: ["空间转录组分析", "Python 数据科学栈", "R 语言", "高通量数据处理"],
  },
  {
    title: "前端与全栈工程",
    icon: <Code2 size={16} className="text-text-muted" />,
    items: ["Next.js 15", "React", "TypeScript", "Tailwind CSS v4"],
  },
  {
    title: "基础设施与工具",
    icon: <Wrench size={16} className="text-text-muted" />,
    items: ["Docker 容器化", "Git 版本控制", "Linux", "CI/CD"],
  },
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

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20 md:px-8 md:py-24">
      {/* 1. Bento Box 风格头部简介  
      grid-cols-1：在手机上，把这个区域切成 1 列（也就是说，里面的盒子只能上下堆叠）。
      md:grid-cols-3：到了电脑屏幕上（md:），马上把地基重新划分为 3 列。
      md:gap-12：在电脑上，这 3 列之间的缝隙（沟壑）宽度设为 12 个单位（48px）。*/}
      <section className="mb-24 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
        {/* 左侧视觉锚点保持不变 
        col-span-1：不管在什么设备上，这个卡片都只占地基里的 1 列的宽度。
        flex flex-col：把卡片内部变成弹性盒子（flex），并且规定里面的内容从上到下垂直排列（col = column）。
        justify-between：既然是垂直排列，这个属性会把卡片内部的元素两端对齐。最上面的字顶到天花板，最下面的字踩到底板，中间留出最大的空隙。
        p-6：Padding 为 6。卡片内部上下左右都留出 24px 的内边距，文字不会贴着卡片边缘。
        md:h-full：到了电脑上，强制让这个卡片的高度达到 100%（撑满父容器的高度）。
        leading-[1.3]：leading 控制的是行高（行间距）。中括号 [] 表示自定义任意数值。*/}
        <div className="col-span-1 flex flex-col justify-between rounded-2xl border border-border bg-bg-subtle p-6 md:h-full">
          <div>
            <div className="mb-4 h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center">
              <span className="text-xl font-bold text-accent font-mono">
                CY
              </span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">
              Chenyu
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Bioinformatics × Frontend
            </p>
          </div>
          <div className="mt-8 text-[11px] text-text-subtle font-mono uppercase tracking-widest">
            Based in Web
          </div>
        </div>

        {/* 右侧：用结构化区块代替长篇大论 
        hidden：在手机上，把这个换行符隐藏掉（当它不存在，让文字自然排版）。
        sm:bock：到了大屏幕上，让这个换行符生效。*/}
        <div className="col-span-1 md:col-span-2 flex flex-col justify-center">
          <h2 className="mb-8 text-2xl font-medium tracking-tight text-text-primary sm:text-3xl leading-[1.3]">
            在生命科学与代码工程的交汇处，
            <br className="hidden sm:block" />
            构建优雅的数字秩序。
          </h2>

          {/* 将大段落拆解为两个干练的“专注领域”卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Microscope size={16} className="text-accent" />
                生信研究
              </div>
              <p className="text-sm leading-[1.7] text-text-secondary">
                目前作为研究生，专注于空间转录组数据分析。致力于从海量的生物序列中提取特征，寻找生命的底层模式与规律。
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Terminal size={16} className="text-accent" />
                全栈开发
              </div>
              <p className="text-sm leading-[1.7] text-text-secondary">
                痴迷于现代 Web 技术的美感与秩序。享受用 Next.js
                和严谨的设计系统，将复杂数据转化为极简、高效的用户体验。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 结构化技能网格 - 压缩高度，变得轻盈 */}
      <section className="mb-24">
        <h3 className="mb-6 text-lg font-semibold tracking-tight text-text-primary">
          技术图谱
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SKILL_CATEGORIES.map((category) => (
            <div
              key={category.title}
              /* 修改点：p-5 改为 p-4，gap-4 改为 gap-3，整体瘦身 */
              className="flex flex-col gap-3 rounded-xl border border-border bg-transparent p-4 transition-colors hover:bg-bg-subtle"
            >
              <div className="flex items-center gap-2">
                {category.icon}
                <h4 className="text-[13px] font-medium text-text-primary">
                  {category.title}
                </h4>
              </div>
              {/* flex-wrap 的作用：它打破了这种固执。它告诉容器：“如果第一排的空间满了，不要挤压大家，请自然地折行，排到第二排去。” */}
              <div className="flex flex-wrap gap-2">
                {category.items.map((item) => (
                  <span
                    key={item}
                    /* 修改点：减小文字和内边距，让技能块更紧致 */
                    className="rounded bg-bg-muted px-2 py-[2px] text-[12px] text-text-secondary"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. 增强交互的时间线 - 日期升级为胶囊标签 */}
      <section>
        <h3 className="mb-8 text-lg font-semibold tracking-tight text-text-primary">
          成长轨迹
        </h3>
        {/* ml-3：Margin-Left (12px)。把整条线往右推一点，不要紧贴着屏幕最左侧。
        border-l & border-border：
        border-l = 仅仅画一条左边框（这就是那条垂直的时间线）。
        border-border = 使用你主题配置里的默认边框颜色。
        space-y-4：直接在父容器写 space-y-4，它会自动在子元素之间（除了第一个）均匀地插入 16px 的垂直间距。
        -ml-[1px]：加上负 1 像素的左外边距，强行把整个盒子向左拉 1px
        rounded-r-lg：rounded = 圆角，lg = 大弧度，r = Right（只圆右边）*/}
        <div className="relative ml-3 border-l border-border space-y-4">
          {TIMELINE_DATA.map((item, index) => (
            <div
              key={index}
              className="group relative -ml-[1px] pl-8 py-2 transition-all hover:bg-bg-subtle/50 rounded-r-lg"
            >
              {/* 交互式圆点，位置微调以适应新的内边距
              group-hover:scale-125：这个小圆点立刻放大到原本的 125%（变大）
              ring-4：在圆点外面套一圈 4px 宽的光环（阴影）
              ring-background：把这圈光环的颜色，设置成和网页底层背景色一模一样 */}
              <div className="absolute -left-[5px] top-[18px] h-2.5 w-2.5 rounded-full bg-border transition-all duration-300 group-hover:scale-125 group-hover:bg-accent ring-4 ring-background" />
              {/* 垂直对齐：items-start  这通常用在 flex flex-col（弹性垂直布局）的容器里 底层 CSS：align-items: flex-start;
              border-border/60：边框颜色使用主题边框色，透明度降为 60%。*/}
              <div className="flex flex-col items-start gap-2">
                {/* 修改点：日期升级为极客风胶囊标签 */}
                <time className="rounded-md border border-border/60 bg-bg-muted/50 px-2.5 py-0.5 text-[11px] font-mono tracking-wider text-text-muted uppercase">
                  {item.date}
                </time>

                <h4 className="mt-1 text-[15px] font-medium text-text-primary group-hover:text-accent transition-colors">
                  {item.title}
                </h4>
                <p className="text-sm leading-[1.7] text-text-secondary">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 分割线：平滑过渡到联系区域 */}
      <hr className="mt-12 mb-8 border-border" />

      <section>
        <div className="mb-12">
          <h3 className="mb-4 text-2xl font-semibold tracking-tight text-text-primary">
            取得联系
          </h3>
          <p className="text-base leading-[1.7] text-text-secondary max-w-2xl">
            无论是关于空间转录组的学术探讨、Next.js
            的技术交流，还是全职/实习的工作机会，我都随时欢迎你的来信。
          </p>
        </div>
        {/* 左右非对称网格结构 */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-5 md:gap-16">
          {/* 左侧：社交链路 */}
          <div className="col-span-1 md:col-span-2">
            <a
              href="mailto:your.email@example.com"
              className="group flex items-center gap-3 text-sm text-text-secondary transition-colors hover:text-accent"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-subtle group-hover:border-accent/30 group-hover:bg-accent-subtle transition-colors">
                <Mail size={19} />
              </span>
              your.email@example.com
            </a>
            <a
              href="https://github.com/yourusername"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 text-sm text-text-secondary transition-colors hover:text-accent"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-subtle group-hover:border-accent/30 group-hover:bg-accent-subtle transition-colors">
                <FaGithub size={19} />
              </span>
              GitHub
            </a>
            <a
              href="https://twitter.com/yourusername"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 text-sm text-text-secondary transition-colors hover:text-accent"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-subtle group-hover:border-accent/30 group-hover:bg-accent-subtle transition-colors">
                <FaTwitter size={19} />
              </span>
              X (Twitter)
            </a>
          </div>
          {/* 右侧：Client Component 表单 */}
          <div className="col-span-1 md:col-span-3">
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
