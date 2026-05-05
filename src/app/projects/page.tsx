// src/app/projects/page.tsx
import type { Metadata } from "next";
import ProjectList from "@/components/projects/project-list";
import { projectsData } from "@/lib/projects";

export const metadata: Metadata = {
  title: "项目 | Chenyu",
  description: "开源项目、技术实践与实验室成果展示",
};

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20 md:px-8 md:py-24">
      {/* 页面头部 */}
      <header className="mb-16 max-w-3xl">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          项目
        </h1>
        <p className="text-lg leading-[1.7] text-text-secondary">
          从生物信息学数据分析流程，到前端全栈工程实践。这里记录了我构建过的开源工具、脚本与实验性项目。
        </p>
      </header>

      {/* 注入客户端组件并传入静态数据 */}
      <ProjectList projects={projectsData} />
    </div>
  );
}
