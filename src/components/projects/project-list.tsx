// src/components/projects/project-list.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import type { Project } from "@/lib/projects";

export default function ProjectList({ projects }: { projects: Project[] }) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 提取并去重所有技术栈标签
  const allTags = Array.from(
    new Set(projects.flatMap((project) => project.tags)),
  );

  const filteredProjects = selectedTag
    ? projects.filter((project) => project.tags.includes(selectedTag))
    : projects;

  return (
    <div>
      {/* 标签筛选区 */}
      {allTags.length > 0 && (
        <div className="mb-12 flex flex-wrap gap-8 border-b border-border/50 pb-[1px]">
          <button
            onClick={() => setSelectedTag(null)}
            className={`relative pb-3 text-sm transition-colors ${
              selectedTag === null
                ? "font-medium text-text-primary after:absolute after:-bottom-[1px] after:left-0 after:h-[2px] after:w-full after:bg-accent"
                : "font-normal text-text-muted hover:text-text-primary"
            }`}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`relative pb-3 text-sm transition-colors ${
                selectedTag === tag
                  ? "font-medium text-text-primary after:absolute after:-bottom-[1px] after:left-0 after:h-[2px] after:w-full after:bg-accent"
                  : "font-normal text-text-muted hover:text-text-primary"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 项目卡片网格 */}
      <div className="grid gap-6 sm:grid-cols-2">
        {filteredProjects.map((project, index) => (
          <article
            key={project.id}
            // 1. 确保容器有 relative 和 overflow-hidden，这样底部生长的线条才不会溢出圆角
            // 2. 依然保留边框颜色的轻微加深（hover:border-accent/30）作为基底
            className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-border/60 bg-bg-subtle px-6 pb-6 pt-5 transition-all duration-300 hover:border-accent/30 hover:bg-background hover:shadow-sm"
          >
            {/* 底部能量线展开动效。从左侧 50% 的位置向两边展开，高度 2px */}
            <div className="absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 bg-accent transition-all duration-300 ease-out group-hover:w-full" />
            <div>
              {/* 2：强制下达死命令——“这个字符串最终的长度必须绝对等于 2”。
              "0"：如果长度不够 2 怎么办？“用字符 "0" 从左边（Start）填补空白”。 */}
              <span className="mt-1 mb-1 block font-mono text-[11px] tracking-widest text-text-subtle">
                {String(index + 1).padStart(2, "0")} /
                {String(filteredProjects.length).padStart(2, "0")}
              </span>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[17px] font-medium tracking-tight text-text-primary group-hover:text-accent transition-colors">
                  {project.title}
                </h2>
                <div className="flex gap-[2px] text-text-muted">
                  {project.githubUrl && (
                    <Link
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/githubBtn relative flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-primary"
                      aria-label={`${project.title} 的 GitHub 仓库`}
                    >
                      {/* 增加 opacity-50 降低视觉干扰 */}
                      <svg
                        className="absolute inset-0 h-full w-full opacity-50"
                        viewBox="0 0 32 32"
                      >
                        <path
                          d="M 16 31 A 15 15 0 0 1 16 1"
                          fill="none"
                          stroke="var(--color-accent)"
                          strokeWidth="1" // 线宽由 1.2 降为 1
                          strokeLinecap="round"
                          className="transition-all duration-500 ease-out [stroke-dasharray:48] [stroke-dashoffset:48] group-hover/githubBtn:[stroke-dashoffset:0]"
                        />
                        <path
                          d="M 16 31 A 15 15 0 0 0 16 1"
                          fill="none"
                          stroke="var(--color-accent)"
                          strokeWidth="1" // 线宽由 1.2 降为 1
                          strokeLinecap="round"
                          className="transition-all duration-500 ease-out [stroke-dasharray:48] [stroke-dashoffset:48] group-hover/githubBtn:[stroke-dashoffset:0]"
                        />
                      </svg>
                      <FaGithub size={20} className="relative z-10" />
                    </Link>
                  )}
                  {project.liveUrl && (
                    <Link
                      href={project.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/liveBtn relative flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-primary"
                      aria-label={`${project.title} 的在线演示`}
                    >
                      <svg
                        className="absolute inset-0 h-full w-full opacity-50"
                        viewBox="0 0 32 32"
                      >
                        <path
                          d="M 16 29 L 11 29 A 8 8 0 0 1 3 21 L 3 11 A 8 8 0 0 1 11 3 L 18 3"
                          fill="none"
                          stroke="var(--color-accent)"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-all duration-500 ease-out [stroke-dasharray:48] [stroke-dashoffset:48] group-hover/liveBtn:[stroke-dashoffset:0]"
                        />
                        <path
                          d="M 16 29 L 21 29 A 8 8 0 0 0 29 21 L 29 14"
                          fill="none"
                          stroke="var(--color-accent)"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-all duration-500 ease-out [stroke-dasharray:25] [stroke-dashoffset:25] group-hover/liveBtn:[stroke-dashoffset:0]"
                        />
                      </svg>
                      {/* 第一性原理修复：进行“视觉对齐”补偿，向右上角微调 1px 平衡负空间 */}
                      <ExternalLink
                        size={20}
                        className="relative z-10 -translate-y-[1px] translate-x-[1px]"
                      />
                    </Link>
                  )}
                </div>
              </div>
              <p className="mb-6 text-[14px] leading-[1.7] text-text-secondary">
                {project.description}
              </p>
            </div>

            {/* 技术标签简化，使用连字符与分隔点合并为纯文本格式 */}
            <div className="font-mono text-[12px] text-text-subtle">
              —— {project.tags.join(" · ")}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
