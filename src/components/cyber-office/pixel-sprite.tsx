"use client";

import { useEffect, useRef } from "react";
import type { PixelMap } from "@/lib/cyber-office/character-atlas";

const CELL = 4; // 每个像素放大成 4×4 屏幕像素（想让小人更大就调大）

export default function PixelSprite({ layers }: { layers: PixelMap[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  // 画布的逻辑尺寸 = 网格列数 × 行数（取所有图层里最大的范围）
  const cols = Math.max(
    ...layers.map((l) => Math.max(...l.rows.map((r) => r.length))),
  );
  const rows = Math.max(...layers.map((l) => l.rows.length));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false; // 不做平滑，保持硬像素
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 一层一层画：body → arms →（可选）配件，后面的盖在前面的上
    for (const layer of layers) {
      for (let y = 0; y < layer.rows.length; y++) {
        const row = layer.rows[y];
        for (let x = 0; x < row.length; x++) {
          const color = layer.palette[row[x]];
          if (!color) continue; // '.'、空格、未定义 = 透明，跳过
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1); // 先按 1:1 画，再靠 CSS 放大
        }
      }
    }
  }, [layers]);

  return (
    <canvas
      ref={ref}
      width={cols}
      height={rows}
      aria-hidden
      style={{
        width: cols * CELL,
        height: rows * CELL,
        imageRendering: "pixelated", // 放大保持像素锐利
        display: "block",
      }}
    />
  );
}
