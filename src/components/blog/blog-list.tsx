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
        // flex-wrap：当标签过多时，允许它们换行排列，保持界面整洁
        // gap-2：标签之间(包括上下和左右两个方向)保持 8px 的间距，避免拥挤
        // pb-1: padding-bottom,0.25rem;（即 4px 的底部内边距）
        <div className="mb-12 flex flex-wrap gap-5">
          <button
            onClick={() => setSelectedTag(null)}
            className={`relative pb-1 text-sm transition-colors ${
              selectedTag === null
                ? "font-medium text-text-primary" // 激活态：品牌主色
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            全部
            {/* 看到父级有 relative，就会把这个按钮的左下角当成自己的 bottom-0 left-0 */}
            <span
              className={`absolute bottom-0 left-0 h-[2px] bg-accent transition-all duration-300 ease-out ${
                selectedTag === null ? "w-full" : "w-0"
              }`}
            />
          </button>

          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`relative pb-1 text-sm transition-colors ${
                selectedTag === tag
                  ? "font-medium text-text-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {tag}
              <span
                className={`absolute bottom-0 left-0 h-[2px] bg-accent transition-all duration-300 ease-out ${
                  selectedTag === tag ? "w-full" : "w-0"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* 垂直文章列表 */}
      <div className="flex flex-col">
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
