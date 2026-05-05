export type Project = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  githubUrl?: string;
  liveUrl?: string;
};

export const projectsData: Project[] = [
  {
    id: "trend-radar-docker",
    title: "TrendRadar Docker",
    description:
      "基于 Docker 容器化的开源趋势雷达系统。集成自动化部署与安全更新监控，提供稳定、可隔离的运行环境。",
    tags: ["Docker", "Python", "CI/CD"],
    githubUrl: "https://github.com/yourusername/TrendRadar_docker",
  },
  {
    id: "spatial-transcriptomics-pipeline",
    title: "空间转录组分析 Pipeline",
    description:
      "用于处理和可视化生物信息学中空间转录组数据的自动化分析流程，极大提升了多样本比对的效率。",
    tags: ["Bioinformatics", "R", "Python"],
    githubUrl: "https://github.com",
    liveUrl: "https://example.com",
  },
  {
    id: "personal-portfolio",
    title: "极简开发者作品集",
    description:
      "基于 Next.js 15 和 Tailwind CSS v4 构建的个人数字花园。融合 Apple 与 Linear 的设计哲学，支持 MDX 渲染与平滑暗黑模式。",
    tags: ["Next.js", "React", "Tailwind CSS"],
    githubUrl: "https://github.com",
    liveUrl: "https://yourdomain.com",
  },
];
