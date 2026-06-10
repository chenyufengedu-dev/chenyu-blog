import Link from "next/link";
import HomeHero from "@/components/home/home-hero";
import BlogCard from "@/components/blog/blog-card";
import { getAllPostsMeta } from "@/lib/mdx";
import { projectsData } from "@/lib/projects";

export default function Home() {
  // 首页是服务端组件，可以安全读取 MDX 文件系统数据。
  // getAllPostsMeta() 内部使用了 fs，所以不能放在 "use client" 组件里调用。
  // slice(start, end): 0（起始指针）; 3（结束指针 - 开区间法则）,通常是一个“左闭右开”区间 [0, 3)
  const recentPosts = getAllPostsMeta().slice(0, 3);

  // 首页只展示少量精选项目，完整筛选体验留给 /projects。
  // slice(0, 2) 表示从 projectsData 里取前两个项目。
  const selectedProjects = projectsData.slice(0, 2);

  return (
    <div className="relative w-full">
      {/* 首页第一屏：保留原来的探照灯交互 Hero */}
      <HomeHero />

      {/* 内容区：在 Hero 之后提供真实可滚动内容，回应“向下滚动查看更多”的提示 */}
      <section className="relative z-10 bg-white px-6 py-24 dark:bg-[#0a0a0a] md:px-8">
        <div className="mx-auto max-w-5xl">
          {/* 精选文章区域头部 */}
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-widest text-text-muted">
              Recent Writing
            </h2>
            <Link
              href="/blog"
              className="text-sm text-text-muted transition-colors hover:text-accent"
            >
              全部文章 →
            </Link>
          </div>

          {/* 复用博客列表里的 BlogCard，保持文章列表风格一致 */}
          <div className="flex flex-col">
            {recentPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>

          {/* 精选项目区域头部 */}
          <div className="mb-8 mt-16 flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-widest text-text-muted">
              Selected Work
            </h2>
            <Link
              href="/projects"
              className="text-sm text-text-muted transition-colors hover:text-accent"
            >
              全部项目 →
            </Link>
          </div>

          {/* 首页项目预览：只做克制的文本型展示，不把项目页的大卡片完整搬过来 */}
          <div className="grid gap-6 sm:grid-cols-2">
            {selectedProjects.map((project) => (
              <article
                key={project.id}
                className="border-t border-border/60 pt-5"
              >
                <h3 className="text-[17px] font-medium tracking-tight text-text-primary">
                  {project.title}
                </h3>

                <p className="mt-4 text-[14px] leading-[1.7] text-text-secondary">
                  {project.description}
                </p>

                <p className="mt-3 font-mono text-[12px] text-text-subtle">
                  —— {project.tags.join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
