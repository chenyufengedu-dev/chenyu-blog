// 站点级共享常量。
// 域名只在这里写一次：以后换正式域名，改这一处即可，sitemap / RSS / 各页 metadata 全部跟着变。
// 优先读环境变量 NEXT_PUBLIC_SITE_URL（Vercel 上可按环境配不同值），没配就用默认值兜底。
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://chenyu-blog.vercel.app";

export const SITE_NAME = "Chenyu";
