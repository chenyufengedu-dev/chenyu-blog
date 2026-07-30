// 单物体抠图：把一张"物体 + 纯色背景"的图去底转透明、裁紧、可缩放。
// 用法：node scripts/cutout.mjs <输入.png> <输出.png> [目标高度px]
//   例：node scripts/cutout.mjs public/sprites/_src/table.png public/cyber-office/table.png 260
// 原理同 split-poses：四角取背景色 → 从边缘泛洪去底（不误吃物体内部同色区）→ 裁到内容框 → 缩放导出。

import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

const [, , inputFile, outputFile, targetHArg] = process.argv;
if (!inputFile || !outputFile) {
  console.error("用法: node scripts/cutout.mjs <输入.png> <输出.png> [目标高度px]");
  process.exit(1);
}
const TOL = 42;

const png = PNG.sync.read(fs.readFileSync(inputFile));
const { width: W, height: H, data } = png;
const idx = (x, y) => (W * y + x) << 2;

const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]];
let br = 0, bg = 0, bb = 0;
for (const [x, y] of corners) {
  const i = idx(x, y);
  br += data[i]; bg += data[i + 1]; bb += data[i + 2];
}
br /= 4; bg /= 4; bb /= 4;
const near = (i) => {
  const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db) < TOL;
};

const cleared = new Uint8Array(W * H);
const stack = [];
const pushIf = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const p = W * y + x;
  if (cleared[p]) return;
  if (near(p << 2)) { cleared[p] = 1; stack.push(x, y); }
};
for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); }
for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); }
while (stack.length) {
  const y = stack.pop(), x = stack.pop();
  pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1);
}
for (let p = 0; p < W * H; p++) if (cleared[p]) data[(p << 2) + 3] = 0;

// 内容包围盒
let top = H, bot = -1, left = W, right = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[idx(x, y) + 3] > 16) {
      if (y < top) top = y; if (y > bot) bot = y;
      if (x < left) left = x; if (x > right) right = x;
    }
  }
}
if (bot < 0) { console.error("整张都被判为背景，调小 TOL"); process.exit(2); }

const cw = right - left + 1;
const ch = bot - top + 1;
const targetH = Number(targetHArg) || ch;
const scale = targetH / ch;
const outW = Math.max(1, Math.round(cw * scale));
const outH = Math.round(ch * scale);

const out = new PNG({ width: outW, height: outH });
for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    const sx = Math.min(cw - 1, Math.floor(x / scale)) + left;
    const sy = Math.min(ch - 1, Math.floor(y / scale)) + top;
    const s = idx(sx, sy);
    const t = (outW * y + x) << 2;
    out.data[t] = data[s];
    out.data[t + 1] = data[s + 1];
    out.data[t + 2] = data[s + 2];
    out.data[t + 3] = data[s + 3];
  }
}
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, PNG.sync.write(out));
console.log(`✓ ${outputFile}  (${outW}x${outH})`);
