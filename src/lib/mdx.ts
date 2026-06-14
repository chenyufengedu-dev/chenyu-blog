// src/lib/mdx.ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";

// 定义文章元数据的 TypeScript 类型
export type BlogPostMetadata = {
  title: string;
  date: string;
  summary: string;
  tags: string[];
  slug: string;
};

// 锁定内容文件夹的绝对物理路径
const rootDirectory = path.join(process.cwd(), "src", "content", "blog");

/**
 * 根据文件名 (slug) 获取单篇文章的元数据和原始 MDX 文本
 */
export const getPostBySlug = (slug: string) => {
  const realSlug = slug.replace(/\.mdx$/, "");
  const filePath = path.join(rootDirectory, `${realSlug}.mdx`);

  // 以 utf8 格式同步读取文件字符串
  const fileContent = fs.readFileSync(filePath, "utf8");

  // 使用 gray-matter 分离顶部的 YAML metadata 和底部的正文
  const { data, content } = matter(fileContent);

  // 给文章 frontmatter 加兜底，避免漏字段崩溃 （比如 tags 漏写时后续 .map / .includes 崩溃）
  return {
    metadata: {
      title: data.title ?? "无标题",
      date: data.date ?? "",
      summary: data.summary ?? "",
      // 关键：tags 漏写时兜底为空数组，避免后续 .map / .includes 崩溃
      tags: Array.isArray(data.tags) ? data.tags : [],
      slug: realSlug,
    } as BlogPostMetadata,
    content,
  };
};

/**
 * 遍历文件夹，获取所有文章的元数据，并按日期倒序排列（用于博客列表页）
 */
export const getAllPostsMeta = (): BlogPostMetadata[] => {
  // 容错处理：如果文件夹不存在则先不报错，返回空数组
  if (!fs.existsSync(rootDirectory)) {
    return [];
  }

  const files = fs.readdirSync(rootDirectory);

  const posts = files
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const { metadata } = getPostBySlug(file);
      return metadata;
    })
    // 按照时间戳进行降序排序（最新的文章排在最前面）
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
};

/**
 * 获取相邻文章（上一篇/下一篇），用于文章底部的阅读导航
 * 逻辑：getAllPostsMeta 已经按日期降序排列（最新的在最前）
 * - 上一篇 (prev)：比当前文章更新的文章（即数组索引 - 1）
 * - 下一篇 (next)：比当前文章更旧的文章（即数组索引 + 1）
 */
export const getAdjacentPosts = (slug: string) => {
  const allPosts = getAllPostsMeta();
  const currentIndex = allPosts.findIndex((post) => post.slug === slug);

  // 如果找不到当前文章（容错处理），返回 null
  if (currentIndex === -1) {
    return { prev: null, next: null };
  }

  // 索引大于 0 说明前面还有更新的文章
  const prev = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  // 索引小于 length - 1 说明后面还有更旧的文章
  const next =
    currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

  return { prev, next };
};
