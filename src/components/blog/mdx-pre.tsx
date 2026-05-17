"use client";

import { useState, useRef, ComponentPropsWithoutRef } from "react";

// 定义精确的 Props 类型，继承原生 pre 标签的所有合法属性，并补充 rehype 注入的自定义属性
interface MdxPreProps extends ComponentPropsWithoutRef<"pre"> {
  "data-language"?: string;
}

//useRef本质上是充当一个“不会触发页面刷新的变量”
// 接收 MDX 传递给 <pre> 的所有原生属性
export default function MdxPre({ children, ...props }: MdxPreProps) {
  //  // 💥 在这里加一行打印代码，直接把箱子拆开看！
  //   console.log("拦截到的 props 是啥：", props);

  //物理探针（Ref）是 React 提供的一种机制，允许你直接访问 DOM 元素或组件实例。在这个组件中，我们创建了一个 preRef 来引用 <pre> 标签，这样我们就可以在 handleCopy 函数中直接访问它的内容。
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  // rehype-pretty-code 会自动将语言类型注入到 data-language 属性中
  const language = props["data-language"] || "text";

  const handleCopy = async () => {
    if (preRef.current) {
      // 提取原生文本（忽略内部的高亮 HTML 标签）把代码块里那些乱七八糟的高亮 HTML 标签（比如 <span color="red">）全部剥离粉碎掉，只留下人类能看懂的纯文本代码
      //JavaScript 有个铁律：被 const 声明的变量，它的本体是绝对不允许被重新赋值的。 只要 myRef 是一个对象就能修改里面的值。所以必须要用.current来访问和修改这个对象内部的值。
      // {
      //   current: null // 默认是空的
      // }
      //myRef内部的内容如上
      const text = preRef.current.innerText;
      // navigator.clipboard：这是浏览器提供给你的剪贴板控制权 API .writeText(text)：直接给用户的操作系统（Windows 或 macOS）下达命令：“把这段 text 塞进用户的剪贴板里去！”
      await navigator.clipboard.writeText(text);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="group relative">
      {/* 悬浮状态栏：默认透明(opacity-0)，Hover 时显现(group-hover:opacity-100) 
      items-center 垂直方向上绝对居中对齐
      transition-opacity 设置不要瞬间变，要用平滑的动画渐变过渡 与duration-300配合使用*/}
      <div className="absolute right-3 top-1 z-10 flex items-center gap-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        {/* 语言标签 */}
        <span className="text-[11px] font-mono text-text-subtle uppercase tracking-wider">
          {language}
        </span>

        {/* 复制按钮 */}
        <button
          onClick={handleCopy}
          className="rounded-md border border-border/50 bg-bg-subtle/80 px-2.5 py-1 text-[11px] text-text-muted backdrop-blur-sm transition-colors hover:bg-bg-subtle hover:text-text-primary"
          aria-label="复制代码"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* 渲染原始的 pre 标签，并将 props（包含类名和高亮样式）原封不动传递下去 */}
      {/* <pre>：这是 HTML 里最古老的标签之一（Preformatted Text）。它的作用是“保留空格和换行”。 */}
      <pre ref={preRef} {...props}>
        {children}
      </pre>
    </div>
  );
}
