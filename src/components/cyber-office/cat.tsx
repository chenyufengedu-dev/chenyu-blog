"use client";

import { useRef, useState } from "react";
import PixelSprite from "./pixel-sprite";
import type { PixelMap } from "@/lib/cyber-office/character-atlas";

// 一只坐着的橘猫（10×8 起步版，之后可精修）
const CAT_LAYER: PixelMap = {
  palette: {
    c: "#e8a24a", // 身体
    f: "#f4c07a", // 脸/浅色
    e: "#2a2333", // 眼睛
    p: "#e88a94", // 鼻子（粉）
    w: "#f8ead6", // 胸口白
  },
  rows: [
    "..c....c..",
    ".cccccccc.",
    ".ceffffec.",
    ".cfppppfc.",
    ".cffffffc.",
    "..cccccc..",
    "..cwwwwc..",
    "..cc..cc..",
  ],
};

// 点一下随机蹦一句
const REACTIONS = ["喵~", "呼噜呼噜~", "喵呜！", "……（打了个哈欠）"];

export default function Cat() {
  const [reaction, setReaction] = useState<string | null>(null);
  const [hopping, setHopping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = () => {
    setReaction(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    setHopping(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setReaction(null);
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
      {/* 点击时套上 cat-hop 动画类 */}
      <span className={hopping ? "block cat-hop" : "block"}>
        <PixelSprite layers={[CAT_LAYER]} />
      </span>
    </button>
  );
}
