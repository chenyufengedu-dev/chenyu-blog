// src/components/contact/contact-form.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CheckCircle2 } from "lucide-react";

// 定义 Zod 校验规则（Schema）
const contactSchema = z.object({
  name: z.string().min(2, { message: "名字至少需要 2 个字符" }),
  email: z.string().email({ message: "请输入有效的邮箱地址" }),
  message: z.string().min(10, { message: "留言内容至少需要 10 个字符" }),
});

// 从 Schema 中推导出 TypeScript 类型
type ContactFormValues = z.infer<typeof contactSchema>;

export default function ContactForm() {
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  // 模拟表单提交逻辑
  const onSubmit = async (data: ContactFormValues) => {
    // 这里未来可以替换为真实的 API 请求（如 Formspree 或 Vercel Serverless Function）
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("提交的数据:", data);
    setIsSuccess(true);
  };

  // 提交成功后的 UI
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-subtle p-8 text-center animate-in fade-in duration-500">
        <CheckCircle2 size={40} className="mb-4 text-accent" />
        <h3 className="mb-2 text-lg font-medium text-text-primary">
          消息已发送
        </h3>
        <p className="text-sm text-text-secondary">
          感谢你的留言！我会尽快通过邮件与你联系。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* 姓名输入 */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="name"
          className="text-[13px] font-medium text-text-secondary"
        >
          名字
        </label>
        <input
          id="name"
          type="text"
          placeholder="怎么称呼你？"
          {...register("name")}
          className="rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text-primary transition-colors placeholder:text-text-subtle focus:border-accent focus:bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {errors.name && (
          <span className="text-xs text-red-500/80">{errors.name.message}</span>
        )}
      </div>

      {/* 邮箱输入 */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[13px] font-medium text-text-secondary"
        >
          邮箱
        </label>
        <input
          id="email"
          type="email"
          placeholder="your@email.com"
          {...register("email")}
          className="rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text-primary transition-colors placeholder:text-text-subtle focus:border-accent focus:bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {errors.email && (
          <span className="text-xs text-red-500/80">
            {errors.email.message}
          </span>
        )}
      </div>

      {/* 留言内容 */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="message"
          className="text-[13px] font-medium text-text-secondary"
        >
          留言
        </label>
        {/* resize-none:彻底禁用拖拽缩放功能，锁定文本框的大小。你给它设了几行（rows={5}），它就永远是那么大。
        outline-none：浏览器（比如 Chrome）默认会在你点击输入框时，给它加上一圈很粗的、极其违和的蓝色高亮边框（outline）。这行代码的作用是直接“干掉”浏览器的默认蓝色发光边框。
        ring-1 ring-accent：干掉系统默认的边框后，我们自己画一个。画一圈 1 像素宽的环（ring），颜色使用你的品牌主色（accent）。 */}
        <textarea
          id="message"
          rows={5}
          placeholder="想聊点什么？工作机会、技术探讨或是单纯打个招呼..."
          {...register("message")}
          className="resize-none rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text-primary transition-colors placeholder:text-text-subtle focus:border-accent focus:bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {errors.message && (
          <span className="text-xs text-red-500/80">
            {errors.message.message}
          </span>
        )}
      </div>

      {/* 提交按钮 
      disabled:cursor-not-allowed disabled:opacity-70 :：这两个前缀意思是“当按钮被禁用时”。把透明度降到 70%（变暗），并且当鼠标移上去时，光标变成一个“红圈斜杠”（cursor-not-allowed）*/}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          "发送消息"
        )}
      </button>
    </form>
  );
}
