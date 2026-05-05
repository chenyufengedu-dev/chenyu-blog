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
        <div className="mb-12 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTag(null)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedTag === null
                ? "bg-accent text-white"
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

      {/* 项目卡片网格 */}
      <div className="grid gap-6 sm:grid-cols-2">
        {filteredProjects.map((project) => (
          <article
            key={project.id}
            className="group flex flex-col justify-between rounded-lg border border-border bg-bg-subtle p-6 transition-all duration-300 hover:border-accent/40 hover:bg-background hover:shadow-sm"
          >
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight text-text-primary group-hover:text-accent transition-colors">
                  {project.title}
                </h2>
                <div className="flex gap-3 text-text-muted">
                  {project.githubUrl && (
                    <Link
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-text-primary transition-colors"
                      aria-label={`${project.title} 的 GitHub 仓库`}
                    >
                      <FaGithub size={20} />
                    </Link>
                  )}
                  {project.liveUrl && (
                    <Link
                      href={project.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-text-primary transition-colors"
                      aria-label={`${project.title} 的在线演示`}
                    >
                      <ExternalLink size={20} />
                    </Link>
                  )}
                </div>
              </div>
              <p className="mb-6 text-sm leading-[1.7] text-text-secondary">
                {project.description}
              </p>
            </div>

            {/* 底部技术标签（纯文本形态，保持克制） */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[13px] font-mono text-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
