// src/components/contact/contact-form.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CheckCircle2, Send } from "lucide-react";

// 定义 Zod 校验规则（Schema）
// 于用户在浏览器里输入表单时，TypeScript 已经被编译成了纯 JavaScript（失去了类型检查能力），所以必须用 Zod 这样的库来在代码运行期间拦截不合法的数据。
// 定制化错误反馈 ({ message: "..." })
const contactSchema = z.object({
  name: z.string().min(2, { message: "名字至少需要 2 个字符" }),
  email: z.string().email({ message: "请输入有效的邮箱地址" }),
  message: z.string().min(10, { message: "留言内容至少需要 10 个字符" }),
});

// 从 Schema 中推导出 TypeScript 类型
// typeof contactSchema：获取你刚才定义的 Zod 对象的底层类型。
// z.infer<...>：Zod 提供的反向推导工具。它像一个“榨汁机”，将包含各种校验逻辑的 Zod Schema，剥离掉运行时的校验方法（如 .min, .email），榨取出纯粹的 TypeScript 静态类型。
type ContactFormValues = z.infer<typeof contactSchema>;

export default function ContactForm() {
  const [isSuccess, setIsSuccess] = useState(false);

  // 接管表单的底层状态管理，并将数据校验工作委托给外部库。
  // { resolver: zodResolver(contactSchema) } 校验引擎的注入 (resolver) zodResolver 是一个桥梁，它告诉 React Hook Form：“当你需要校验数据时，请把收集到的数据扔给 contactSchema 处理，并根据它的返回结果来决定是否报错。”
  // 泛型约束 (<ContactFormValues>) 向 useForm 明确声明该表单预期的数据结构
  // register (输入框劫持器)：当你在 JSX 中写下 {...register("email")} 时，这个函数会返回一个包含 name、onChange、onBlur 和 ref 的对象，并将其解构注入到 <input> 中。
  // handleSubmit (提交行为拦截器)：这是一个高阶函数，用于包裹你自定义的提交逻辑。当它绑定到 <form onSubmit={...}> 时，它会严格遵循以下工作流：拦截浏览器的默认刷新行为 -> 触发 Zod 验证规则 -> 如果验证失败，直接终止提交流程并更新 errors -> 如果验证完美通过，才会将清洗后的干净数据作为参数，传递给你写的 onSubmit 函数。
  // formState: { errors, isSubmitting } (响应式状态切片)：用于驱动 UI 反馈的变量
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
      // justify-center 用于控制容器内部元素在主轴（Main Axis）上的对齐方式
      // animate-in fade-in duration-500  animate-in：状态激活指令  fade-in：物理形态的变化规则。它在底层调用了 CSS @keyframes，定义了元素的不透明度（opacity）必须从 0（完全透明）平滑过渡到 1（完全可见）
      //justify- 系列永远控制元素在「主轴」上的对齐。
      //items- 系列永远控制元素在「交叉轴」上的对齐。
      <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-border/70 bg-bg-subtle/60 p-8 text-center animate-in fade-in duration-500">
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

  const fieldClass =
    "rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text-primary transition-colors placeholder:text-text-subtle focus:border-[#ea580c]/45 focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#ea580c]/10";

  return (
    // noValidate 将表单的安全安检工作交给 JavaScript（Zod）全权接管 不用原生自带的 HTML5 表单校验 UI
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
      noValidate
    >
      {/* 姓名输入 */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="name"
          className="text-[13px] font-medium text-text-secondary"
        >
          名字
        </label>
        {/* 通过 JavaScript 的展开操作符 {... }，这四个关键属性的对象：{ onChange, onBlur, name, ref }被悄无声息地“注入”到了 <input> 标签里 */}
        <input
          id="name"
          type="text"
          placeholder="怎么称呼你？"
          {...register("name")}
          className={fieldClass}
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
          placeholder="chenyufeng.edu@gmail.com"
          {...register("email")}
          className={fieldClass}
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
          className={fieldClass}
        />
        {errors.message && (
          <span className="text-xs text-red-500/80">
            {errors.message.message}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-[12px] leading-5 text-text-subtle">
          提交后我会通过邮件回复。
        </p>
        {/* inline-flex (内联弹性盒子) 可以和前后的文字和平共处在同一行 只占自身内容的宽的空间。同时，它的内部依然保留了 flex 的超能力 
        shrink-0 拒绝因为外部空间的减小而被压缩 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-[#ea580c]/25 bg-[#ea580c]/10 px-4 text-[13px] font-medium text-[#c2410c] transition-colors hover:bg-[#ea580c]/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            // animate-spin=animation: spin 1s linear infinite;
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <Send size={13} />
              发送
            </>
          )}
        </button>
      </div>
    </form>
  );
}
