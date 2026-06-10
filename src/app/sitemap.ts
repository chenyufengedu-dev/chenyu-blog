// src/app/sitemap.ts
import { MetadataRoute } from "next";
import { getAllPostsMeta } from "@/lib/mdx";

// 请将其替换为你最终部署时的真实域名
const SITE_URL = "https://chenyu-blog.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  // 1. 获取所有静态基础路由
  const routes = ["", "/blog", "/projects", "/about", "/now"].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date().toISOString().split("T")[0],
  }));

  // 2. 动态获取所有博客文章路由
  const posts = getAllPostsMeta();
  const postRoutes = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date).toISOString().split("T")[0],
  }));

  // 3. 合并返回
  return [...routes, ...postRoutes];
}
