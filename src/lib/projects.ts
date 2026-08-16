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
    id: "cyber-office",
    title: "Cyber Office · 多 Agent 协作实验室",
    description:
      "嵌入本站的多 Agent 圆桌会议系统。主持人 Agent 以结构化 JSON 动态点名调度，产品、前端、生信、审稿等角色轮流发言与互相质疑，最后由总结 Agent 收口。前后端以统一事件流解耦，回放与实时 SSE 共用同一套消费逻辑；内置调用限流与预算保护。页面可实时查看背后的编排流程与调度决策。",
    tags: ["Next.js", "多 Agent 编排", "TypeScript", "SSE"],
    liveUrl: "/cyber-office",
  },
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
