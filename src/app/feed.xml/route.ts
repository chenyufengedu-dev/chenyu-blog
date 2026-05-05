// src/app/feed.xml/route.ts
import RSS from "rss";
import { getAllPostsMeta } from "@/lib/mdx";

const SITE_URL = "https://yourdomain.com";

// App Router 架构中，任何命名为 route.ts 的文件都会变成一个后端的 API 接口
// GET()：这表示该接口只响应 HTTP 的 GET 请求。当用户的 RSS 阅读器在后台静默访问 https://yourdomain.com/feed.xml 时，就会触发这个函数。
export async function GET() {
  // RSS 的本质是一个有着严格格式规定的 XML 文本文件。rss 这个第三方库帮我们免去了手动拼接 <xml><title>...</title></xml> 字符串的痛苦。
  const feed = new RSS({
    title: "Chenyu 的数字花园",
    description: "关于生物信息学、前端开发与数字秩序的思考与记录",
    site_url: SITE_URL,
    feed_url: `${SITE_URL}/feed.xml`,
    language: "zh-CN",
    pubDate: new Date(),
    copyright: `All rights reserved ${new Date().getFullYear()}, Chenyu`,
  });

  const posts = getAllPostsMeta();
  // feed.item(...)：把每一篇文章包装成一个“电台节目”（在 RSS 术语里叫 Item）。这相当于告诉订阅者的阅读器：“我这里有一篇新文章，标题是什么、摘要是什么、原文链接在哪、属于什么标签分类。”
  posts.forEach((post) => {
    feed.item({
      title: post.title,
      description: post.summary,
      url: `${SITE_URL}/blog/${post.slug}`,
      date: post.date,
      // 将 tags 作为分类注入 RSS
      categories: post.tags,
      author: "Chenyu",
    });
  });

  // feed.xml({ indent: true })：让 rss 库把刚才收集的所有信息，正式编译成一大串 XML 格式的字符串
  // "Content-Type: application/xml":加上这个 Header 后，阅读器一拿到数据，就会立刻明白：“哦，这是一个纯正的 XML 订阅源文件”，然后启动特定的解析引擎去提取你的文章。
  return new Response(feed.xml({ indent: true }), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
