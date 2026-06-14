import { getPostBySlug, getAllPostsMeta, getAdjacentPosts } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ComponentPropsWithoutRef } from "react";
import MdxPre from "@/components/blog/mdx-pre";
import ReadingProgress from "@/components/blog/reading-progress";
import MdxImage from "@/components/blog/mdx-image";

// 1. 静态生成 (SSG)：告诉 Next.js 编译时需要预先生成哪些文章页面
export async function generateStaticParams() {
  const posts = getAllPostsMeta();
  return posts.map((post) => ({ slug: post.slug }));
}

// 2. 自定义 MDX 组件：你可以在这里覆盖 Markdown 的默认标签样式
const mdxComponents = {
  a: (props: ComponentPropsWithoutRef<"a">) => {
    // 解决文章正文里所有链接都被强制新标签页打开的问题
    // 判断是否为外部链接：以 http 开头的才算站外
    const isExternal = props.href?.startsWith("http");

    return (
      // 带有主色调（text-accent）、底部有 30%
      // 透明度的下划线（decoration-accent/30），且鼠标悬停时下划线变深（hover:decoration-accent）
      // underline-offset-4 text-underline-offset: 4px; 强制将下划线往下推移 4 个像素。
      <a
        {...props}
        // 只有外链才新开标签页；站内链接（/about 等）保持当前页跳转
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="font-medium text-accent underline decoration-accent/30 underline-offset-4 transition-colors hover:decoration-accent"
      />
    );
  },

  // ComponentPropsWithoutRef，精准告诉 TypeScript：
  // “这个 props 里装的，完全是一个原生 <a>、<code> 或 <img> 标签该有的所有合法属性”。
  // 约束代码块字体
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code {...props} className="font-mono text-[14px]" />
  ),

  // MDX 图片样式优化：
  // Markdown 里的 ![]() 最终会被渲染成 <img>，这里拦截它，给图片加统一外框。
  // 注意：Next.js Image 组件需要提前知道 width/height，
  // 但 MDX 文章里的图片通常只是普通 Markdown 路径，所以这里用原生 img 更简单稳定。

  img: MdxImage,

  pre: MdxPre,
};

// Next.js 15 中，params 是一个 Promise
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  //await params：路由参数（params）从同步对象变成了 Promise（异步对象）。这意味着代码必须先“等待” URL 解析完毕，才能拿到 slug
  const { slug } = await params;

  let post;
  try {
    post = getPostBySlug(slug);
  } catch {
    // 如果 URL 输入了不存在的 slug，直接触发 404 页面
    notFound();
  }
  const { metadata, content } = post;

  // 获取上一篇/下一篇数据
  const { prev, next } = getAdjacentPosts(slug);
  // 4. 计算阅读时间 (中文 300字/分，英文 200词/分)
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (content.match(/\b[a-zA-Z]+\b/g) || []).length;
  const readingTime = Math.ceil(chineseChars / 300 + englishWords / 200);

  // rehype-pretty-code 语法高亮配置
  const rehypeOptions = {
    // 使用深色主题，契合 Linear/Stripe 高级感
    theme: "github-dark-dimmed",
  };

  return (
    <>
      {/* 插入阅读进度条，因为是 fixed 定位，放在这里会自动吸附在页面最顶部 */}
      <ReadingProgress />
      <article className="mx-auto max-w-3xl px-6 py-20 md:px-8 md:py-24">
        {/* 顶部导航与返回 */}
        <div className="mb-6">
          {/* inline-flex: 结合了 inline（内联元素，像普通文字一样，有多宽就占多宽，可以和别的字排在同一行）和 flex（弹性布局）的双重优点 flex，浏览器会把它当成一个“块级盒子（Block）”。  而flex块级盒子有一个非常霸道的特性——它会强行霸占一整行的宽度（100% 宽度）
        items-center 会强行让里面的图标和文字在垂直中轴线上绝对对齐
        group 赋予父容器整个感应区域 */}
          <Link
            href="/blog"
            className="group inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            {/* leading-none 剥离多余空间 浏览器默认会给每一行字上下加上额外的“留白”（行高） leading-none 直接把这些留白扒光，让这个 <span> 的真实高度等于箭头本身的高度 */}
            <ArrowLeft
              size={16}
              className="relative -top-[1.5px] leading-none transition-transform group-hover:-translate-x-1"
            />
            返回博客
          </Link>
        </div>

        {/* 文章 Header */}
        <header className="mb-12 border-b border-border pb-8">
          <h1 className="mb-6 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl leading-[1.2]">
            {metadata.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
            <time dateTime={metadata.date} className="font-mono">
              {metadata.date}
            </time>
            <div className="h-1 w-1 rounded-full bg-border"></div>
            {/* 阅读时间 */}
            <span>约 {readingTime} 分钟读完</span>
            <div className="h-1 w-1 rounded-full bg-border"></div>
            <div className="flex gap-3">
              {metadata.tags.map((tag) => (
                <span key={tag} className="text-accent">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* MDX 正文渲染区 
        使用 prose 类名激活 Typography 插件，并结合自定义设计系统 Token 进行深度覆盖 
      */}
        {/* Typography 基础排版 */}
        <div
          className="
        prose prose-neutral dark:prose-invert max-w-none

        /* 段落文字颜色 + 行高 */
        prose-p:text-text-secondary
        prose-p:leading-[1.7]

        /* 标题颜色 + 字重 + 紧凑字距 */
        prose-headings:text-text-primary
        prose-headings:font-semibold
        prose-headings:tracking-tight

        /* 加粗文字 */
        prose-strong:text-text-primary
        prose-strong:font-semibold

        /* 分割线颜色 */
        prose-hr:border-border


        /* ===== 代码块 figure（最外层黑框）===== */

        /* 整个代码块上下间距 */
        [&_[data-rehype-pretty-code-figure]]:my-5

        /* 超出内容裁切（配合圆角） */
        [&_[data-rehype-pretty-code-figure]]:overflow-hidden

        /* 圆角 */
        [&_[data-rehype-pretty-code-figure]]:rounded-xl

        /* 边框 */
        [&_[data-rehype-pretty-code-figure]]:border
        [&_[data-rehype-pretty-code-figure]]:border-border/50

        /* 深色背景 */
        [&_[data-rehype-pretty-code-figure]]:bg-[#0d1117]


        /* ===== pre（代码滚动区域）===== */

        /* 干掉 typography 默认 margin */
        prose-pre:my-0

        /* 最大宽度不超出父容器 */
        [&_pre]:max-w-full

        /* 横向滚动 */
        [&_pre]:overflow-x-auto

        /* 左右 padding */
        [&_pre]:px-5

        /* 上下 padding */
        [&_pre]:py-3

        /* 背景透明（透出 figure 背景） */
        [&_pre]:!bg-transparent


        /* ===== 隐藏滚动条 ===== */

        /* Chrome/Safari */
        [&_pre::-webkit-scrollbar]:hidden

        /* IE/Edge */
        [&_pre]:[-ms-overflow-style:none]

        /* Firefox */
        [&_pre]:[scrollbar-width:none]


        /* ===== code ===== */

        /* code 使用 grid 布局 */
        [&_pre_code]:grid

        /* 最小宽度撑满 */
        [&_pre_code]:min-w-full

        /* code 背景透明 */
        [&_pre_code]:bg-transparent


        /* ===== 每一行代码 ===== */

        /* 字体大小 */
        [&_pre_code_span]:text-[14px]

        /* 行高 */
        [&_pre_code_span]:leading-7
      "
        >
          <MDXRemote
            source={content}
            components={mdxComponents}
            options={{
              mdxOptions: {
                rehypePlugins: [[rehypePrettyCode, rehypeOptions]],
              },
            }}
          />
        </div>

        {/* 文章底部导航 (上一篇 / 下一篇) */}
        <nav className="mt-16 flex flex-col gap-4 border-t border-border py-8 sm:flex-row sm:justify-between">
          {/* flex-1=flex: 1 1 0%; 给左右两边的盒子都加上 flex-1，意思就是告诉它们：“你们俩把剩下的空间给我五五开平分了，谁也别抢谁的。” 这保证了左右两个按钮各占屏幕一半的面积*/}
          <div className="flex-1">
            {prev && (
              <Link
                href={`/blog/${prev.slug}`}
                className="group flex flex-col items-start gap-1 text-sm text-text-muted transition-colors hover:text-accent"
              >
                <span className="text-[11px] uppercase tracking-widest text-text-subtle ">
                  上一篇
                </span>
                <span className="font-medium text-text-primary group-hover:text-accent">
                  {prev.title}
                </span>
              </Link>
            )}
          </div>
          {/* text-right（右侧对齐 */}
          <div className="flex-1 text-right">
            {next && (
              <Link
                href={`/blog/${next.slug}`}
                className="group flex flex-col items-end gap-1 text-sm text-text-muted transition-colors hover:text-accent"
              >
                <span className="text-[11px] uppercase tracking-widest text-text-subtle ">
                  下一篇
                </span>
                <span className="font-medium text-text-primary group-hover:text-accent">
                  {next.title}
                </span>
              </Link>
            )}
          </div>
        </nav>
      </article>
    </>
  );
}
