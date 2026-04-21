// src/app/blog/[slug]/page.tsx
import { getPostBySlug, getAllPostsMeta } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ComponentPropsWithoutRef } from "react";

// 1. 静态生成 (SSG)：告诉 Next.js 编译时需要预先生成哪些文章页面
export async function generateStaticParams() {
  const posts = getAllPostsMeta();
  return posts.map((post) => ({ slug: post.slug }));
}

// 2. 自定义 MDX 组件：你可以在这里覆盖 Markdown 的默认标签样式
const mdxComponents = {
  a: (props: ComponentPropsWithoutRef<"a">) => (
    // 带有主色调（text-accent）、底部有 30%
    // 透明度的下划线（decoration-accent/30），且鼠标悬停时下划线变深（hover:decoration-accent）
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-accent underline decoration-accent/30 underline-offset-4 transition-colors hover:decoration-accent"
    />
  ),
  //ComponentPropsWithoutRef，精准告诉 TypeScript：“这个 props 里装的，完全是一个原生 <a> 标签或 <code> 标签该有的所有合法属性”。
  // 约束代码块字体
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code {...props} className="font-mono text-[14px]" />
  ),
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
  } catch (error) {
    // 如果 URL 输入了不存在的 slug，直接触发 404 页面
    notFound();
  }

  const { metadata, content } = post;

  // rehype-pretty-code 语法高亮配置
  const rehypeOptions = {
    // 使用深色主题，契合 Linear/Stripe 高级感
    theme: "github-dark-dimmed",
  };

  return (
    <article className="mx-auto max-w-3xl px-6 py-20 md:px-8 md:py-24">
      {/* 顶部导航与返回 */}
      <Link
        href="/blog"
        className="group mb-10 inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft
          size={16}
          className="transition-transform group-hover:-translate-x-1"
        />
        返回博客
      </Link>

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
      <div
        className="
        prose prose-neutral dark:prose-invert max-w-none 
        prose-p:text-text-secondary prose-p:leading-[1.7] 
        prose-headings:text-text-primary prose-headings:font-semibold prose-headings:tracking-tight
        prose-strong:text-text-primary prose-strong:font-semibold
        prose-hr:border-border
        
        /* 1. 内联代码 (Inline Code) 靶向治疗：只选中非代码块里的短代码 */
        [&_:not(pre)>code]:text-accent [&_:not(pre)>code]:bg-accent-subtle [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[14px]
        prose-code:before:content-none prose-code:after:content-none
        
        /* 2. 代码块排版溢出与背景截断的终极修复 */
        /* 约束最外层 figure，画出暗色背景与边框，强制防溢出 */
        [&_[data-rehype-pretty-code-figure]]:max-w-full [&_[data-rehype-pretty-code-figure]]:overflow-hidden [&_[data-rehype-pretty-code-figure]]:rounded-lg [&_[data-rehype-pretty-code-figure]]:border [&_[data-rehype-pretty-code-figure]]:border-border/50 [&_[data-rehype-pretty-code-figure]]:!bg-[#0d1117]
        
        /* 让 pre 负责横向滚动，自身背景透明，透出 figure 的高级暗色 */
        [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:p-4 [&_pre]:!bg-transparent
        [&_pre::-webkit-scrollbar]:hidden [&_pre]:[-ms-overflow-style:none] [&_pre]:[scrollbar-width:none]
        
        /* 强制 code 使用 grid 布局占满整个滚动区域，彻底消灭浅色截断块 */
        [&_pre_code]:grid [&_pre_code]:min-w-full [&_pre_code]:!bg-transparent
        [&_pre_code_span]:text-[14px] [&_pre_code_span]:leading-[1.8]
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
    </article>
  );
}
