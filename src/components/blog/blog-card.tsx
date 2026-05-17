// src/components/blog/blog-card.tsx
import Link from "next/link";
import type { BlogPostMetadata } from "@/lib/mdx";

export default function BlogCard({ post }: { post: BlogPostMetadata }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      // 负边距技巧（-mx-4 px-4）让 hover 背景向外围扩张，维持内部文字的基线对齐
      // 降低边框的存在感（border-border/60）
      className="group flex flex-col gap-2 border-b border-border/60 -mx-4 px-4 py-6 transition-colors duration-300 hover:bg-bg-subtle/50 first:border-t sm:flex-row sm:gap-8 md:py-8"
    >
      {/* 左侧：日期列。使用 pt-1 将基线下移，确保与右侧标题的视觉重心持平 */}
      <time
        dateTime={post.date}
        className="w-24 shrink-0 pt-1 font-mono text-[11px] tracking-widest text-text-subtle uppercase"
      >
        {post.date}
      </time>

      {/* 右侧：内容列。使用 gap-3 增加信息组之间的呼吸感 */}
      <div className="flex flex-col gap-3">
        {/* 标题：提升字号（text-lg）和字重（font-semibold），建立强烈的视觉锚点 */}
        <h3 className="text-lg font-semibold tracking-tight text-text-primary transition-colors group-hover:text-accent">
          {post.title}
        </h3>

        {/* 摘要：加深行高（leading-relaxed），微调颜色透明度以拉开与标题的对比度 */}
        <p className="line-clamp-2 text-[15px] leading-relaxed text-text-secondary/90">
          {post.summary}
        </p>

        {/* 标签列表：使用中点分隔，融入文本流，消除视觉碎片 */}
        <div className="flex gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-accent-subtle px-2 py-0.5 font-mono text-[13px] font-medium text-accent transition-colors"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
