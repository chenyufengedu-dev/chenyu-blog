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

  return {
    metadata: { ...data, slug: realSlug } as BlogPostMetadata,
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
