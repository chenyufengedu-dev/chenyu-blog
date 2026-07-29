"use client";

import { useRef, useState } from "react";

// 小猫在场景里的显示高度（px）
const CAT_DISPLAY_H = 66;

// 点一下随机蹦一句
const REACTIONS = ["喵~", "呼噜呼噜~", "喵呜！", "……（打了个哈欠）"];

export default function Cat() {
  const [frame, setFrame] = useState<"sit" | "happy">("sit"); // 当前显示哪一帧
  const [reaction, setReaction] = useState<string | null>(null);
  const [hopping, setHopping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = () => {
    setReaction(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    setFrame("happy"); // 切到开心抬爪帧
    setHopping(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setReaction(null);
      setFrame("sit"); // 切回平静坐姿
      setHopping(false);
    }, 1600);
  };

  return (
    <button
      type="button"
      onClick={poke}
      aria-label="逗一逗桌上的小猫"
      className="relative block cursor-pointer border-0 bg-transparent p-0"
    >
      {/* 反应气泡 */}
      {reaction && (
        <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-text-secondary shadow-sm">
          {reaction}
        </span>
      )}
      {/* 点击时套上 cat-hop 动画类（来自 globals.css） */}
      <span className={hopping ? "block cat-hop" : "block"}>
        <img
          src={`/sprites/cat-${frame}.png`}
          alt=""
          style={{ height: CAT_DISPLAY_H, width: "auto", display: "block" }}
          draggable={false}
        />
      </span>
    </button>
  );
}
