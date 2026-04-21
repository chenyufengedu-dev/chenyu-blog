// src/components/blog/blog-list.tsx
"use client";

import { useState } from "react";
import type { BlogPostMetadata } from "@/lib/mdx";
import BlogCard from "./blog-card";

export default function BlogList({ posts }: { posts: BlogPostMetadata[] }) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 提取所有不重复的标签
  const allTags = Array.from(new Set(posts.flatMap((post) => post.tags)));

  // 根据当前选中标签过滤文章
  const filteredPosts = selectedTag
    ? posts.filter((post) => post.tags.includes(selectedTag))
    : posts;

  return (
    <div>
      {/* 标签筛选区 */}
      {allTags.length > 0 && (
        <div className="mb-12 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTag(null)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedTag === null
                ? "bg-accent text-white" // 激活态：品牌主色
                : "bg-bg-subtle text-text-muted hover:text-text-primary hover:bg-bg-muted"
            }`}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedTag === tag
                  ? "bg-accent text-white"
                  : "bg-bg-subtle text-text-muted hover:text-text-primary hover:bg-bg-muted"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 垂直文章列表 */}
      <div className="flex flex-col gap-6">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => <BlogCard key={post.slug} post={post} />)
        ) : (
          <p className="py-12 text-center text-text-muted">
            没有找到相关文章。
          </p>
        )}
      </div>
    </div>
  );
}
