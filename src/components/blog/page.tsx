// src/app/blog/page.tsx
import { getAllPostsMeta } from "@/lib/mdx";
import BlogList from "@/components/blog/blog-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "博客 | Chenyu",
  description: "记录技术实践与深度思考",
};

export default function BlogPage() {
  // 在构建时或服务端请求时直接读取文件系统
  const posts = getAllPostsMeta();

  return (
    <div className="mx-auto max-w-3xl px-6 py-20 md:px-8 md:py-24">
      {/* 页面头部 */}
      <header className="mb-16">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          博客
        </h1>
        <p className="text-lg leading-[1.7] text-text-secondary">
          关于前端开发、空间转录组学以及构建数字花园的思考与记录。
        </p>
      </header>

      {/* 注入客户端组件并传入数据 */}
      <BlogList posts={posts} />
    </div>
  );
}
