import Link from "next/link";
import type { BlogPostMetadata } from "@/lib/mdx";

export default function BlogCard({ post }: { post: BlogPostMetadata }) {
  return (
    // className="block"：让整个 <a> 标签变成块级元素，撑满父级容器，这意味着用户点击卡片的任何区域都能触发跳转，而不需要精确瞄准文字。
    <Link href={`/blog/${post.slug}`} className="block group">
      {/* 边框透明（ring-transparent）
      ring-1：利用 CSS 的 box-shadow（盒子阴影）属性，在元素外围画一圈 1 像素的“光环”（视觉上相当于边框）。
      ring-transparent：把这圈光环的颜色设为完全透明。 */}
      <article className="flex flex-col gap-4 rounded-lg bg-bg-subtle p-6 transition-all duration-200 hover:bg-background hover:shadow-sm ring-1 ring-transparent hover:ring-border-subtle">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <time dateTime={post.date} className="text-text-muted">
            {post.date}
          </time>
          <div className="flex gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-text-primary transition-colors group-hover:text-accent">
          {post.title}
        </h2>
        {/* 摘要（限制两行） */}
        <p className="line-clamp-2 text-base leading-[1.7] text-text-secondary">
          {post.summary}
        </p>
      </article>
    </Link>
  );
}
