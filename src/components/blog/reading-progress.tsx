"use client";

import { useEffect, useState } from "react";

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 定义一个计算滚动的函数，并给浏览器装上监听器
    const updateScroll = () => {
      const currentScrollY = window.scrollY;
      //   document 整个网页  .documentElement网页的最根部  innerHeight视口高度
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;

      if (scrollHeight > 0) {
        const percentage = Math.min(
          Math.max((currentScrollY / scrollHeight) * 100, 0),
          100,
        );
        setProgress(percentage);
      } else {
        setProgress(0);
      }
    };
    // 解决初始状态的 UI 同步问题 防止中间进入而进度条却错误的显示为0
    updateScroll();
    // passive: true 解除主线程阻塞，保证页面滚动的极致流畅 。它明确告诉浏览器：“我承诺在这个 updateScroll 函数里，绝对不会调用 preventDefault()”
    window.addEventListener("scroll", updateScroll, { passive: true });

    // 返回一个清理函数
    return () => {
      window.removeEventListener("scroll", updateScroll);
    };
  }, []); // []是依赖数组 控制第一个参数（那个回调函数）到底在什么时候执行、执行多少次   空数组表示这个回调函数只会在组件第一次挂载到 DOM 树上（Mount）时执行唯一的一次。此后，无论组件内部的数据怎么变、怎么重新渲染，引擎都会彻底无视这个 useEffect

  // 将进度四舍五入，避免出现小数
  const roundedProgress = Math.round(progress);
  // 判断是否显示数字：大于 0 且小于 100 时显示
  const showNumber = roundedProgress > 0 && roundedProgress < 100;

  return (
    <div className="fixed left-0 top-0 z-[100] h-[3px] w-full pointer-events-none">
      {/* 静态的、离散的样式 -> 用 className (Tailwind)  动态的、连续的数学计算值 -> 用 style={{ ... }}    { width: ... }是一个JavaScript 对象 style强制要求你必须传一个 JS 对象进去*/}
      <div
        // 增加 relative 以便内部的数字可以相对于进度条末端进行绝对定位
        className="relative h-full rounded-r-full bg-accent transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      >
        {/* 数字进度指示器 */}
        <div
          className={`absolute right-0 top-[0.5px] transition-opacity duration-300 ${
            showNumber ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="font-mono text-[10px] font-medium text-accent">
            {roundedProgress}%
          </span>
        </div>
      </div>
    </div>
  );
}
