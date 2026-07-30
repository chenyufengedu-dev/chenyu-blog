// 把一张「多帧大图」切成 N 张对齐好的透明精灵。
// 用法：node scripts/split-poses.mjs <输入图.png> <前缀id> [目标高度px] [帧名,逗号分隔]
//   角色：node scripts/split-poses.mjs public/sprites/_src/bio-poses.png bio 320
//   小猫：node scripts/split-poses.mjs public/sprites/_src/cat-poses.png cat 120 sit,happy,blink
// 约定：图里从左到右依次对应帧名顺序（默认 standing,raising,sitting）。
// 输出：public/sprites/<前缀>-<帧名>.png
//
// 原理：
//  1) 取四角平均色当背景色，从图像四边「泛洪填充」把连通的背景涂成透明
//     （只删角色外面的背景，不会误删白大褂内部的白——因为有深色描边挡着）。
//  2) 按「整列全透明」的空隙把画面切成 3 个人物。
//  3) 每个人物裁到自己的内容框，再统一贴到「同宽同高、底部对齐」的画布上
//     —— 保证脚踩同一基线，切换姿势不跳。

import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

const [, , inputFile, roleId, targetHArg, posesArg] = process.argv;
if (!inputFile || !roleId) {
  console.error("用法: node scripts/split-poses.mjs <输入图.png> <前缀id> [目标高度px] [帧名,逗号分隔]");
  process.exit(1);
}
const TARGET_H = Number(targetHArg) || 320; // 输出精灵的高度（宽度按比例）
const POSES = (posesArg ? posesArg.split(",") : ["standing", "raising", "sitting"]).map((s) => s.trim()); // 从左到右
const TOL = 42; // 背景色容差：越大删得越狠（当心吃到浅色衣服就调小）

const png = PNG.sync.read(fs.readFileSync(inputFile));
const { width: W, height: H, data } = png;
const idx = (x, y) => (W * y + x) << 2;

// —— 1) 背景色 = 四角平均 —— //
const corners = [
  [0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1],
];
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

// —— 2) 从四边泛洪，把连通背景 alpha 置 0 —— //
const cleared = new Uint8Array(W * H); // 1 = 已作为背景清除
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

// —— 3) 按空列切成若干人物 —— //
const colHasInk = new Array(W).fill(false);
for (let x = 0; x < W; x++) {
  for (let y = 0; y < H; y++) {
    if (data[idx(x, y) + 3] > 16) { colHasInk[x] = true; break; }
  }
}
const spans = [];
let start = -1;
for (let x = 0; x < W; x++) {
  if (colHasInk[x] && start < 0) start = x;
  if ((!colHasInk[x] || x === W - 1) && start >= 0) {
    const end = colHasInk[x] ? x : x - 1;
    if (end - start > W * 0.02) spans.push([start, end]); // 忽略碎屑
    start = -1;
  }
}
if (spans.length !== POSES.length) {
  console.error(`⚠️ 期望切出 ${POSES.length} 帧，实际 ${spans.length} 帧。可能背景没删干净或帧粘连。`);
  console.error(`   spans=${JSON.stringify(spans)} —— 试着调 TOL，或确认三人有明显间隔。`);
  process.exit(2);
}

// 每个人物的内容包围盒（含上下边界，用于底部对齐）
function bbox([x0, x1]) {
  let top = H, bot = -1, left = W, right = -1;
  for (let y = 0; y < H; y++) {
    for (let x = x0; x <= x1; x++) {
      if (data[idx(x, y) + 3] > 16) {
        if (y < top) top = y; if (y > bot) bot = y;
        if (x < left) left = x; if (x > right) right = x;
      }
    }
  }
  return { top, bot, left, right };
}
const boxes = spans.map(bbox);

// 统一画布：宽=最宽人物、高=最高人物（+一点余量），底部对齐
const maxW = Math.max(...boxes.map((b) => b.right - b.left + 1));
const maxH = Math.max(...boxes.map((b) => b.bot - b.top + 1));
const PAD = Math.round(maxH * 0.04);
const canvasW = maxW + PAD * 2;
const canvasH = maxH + PAD * 2;

const outDir = path.join("public", "sprites");
fs.mkdirSync(outDir, { recursive: true });

boxes.forEach((b, i) => {
  const out = new PNG({ width: canvasW, height: canvasH });
  out.data.fill(0);
  const cw = b.right - b.left + 1;
  const dx = Math.round((canvasW - cw) / 2) - b.left; // 水平居中
  const dy = canvasH - PAD - b.bot; // 底部（脚）对齐到同一基线
  for (let y = b.top; y <= b.bot; y++) {
    for (let x = b.left; x <= b.right; x++) {
      const s = idx(x, y);
      if (data[s + 3] <= 16) continue;
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= canvasW || ty >= canvasH) continue;
      const t = (canvasW * ty + tx) << 2;
      out.data[t] = data[s];
      out.data[t + 1] = data[s + 1];
      out.data[t + 2] = data[s + 2];
      out.data[t + 3] = data[s + 3];
    }
  }
  // 缩到目标高度（最近邻，保像素感；如需更柔可改双线性）
  const scale = TARGET_H / canvasH;
  const sw = Math.max(1, Math.round(canvasW * scale));
  const sh = TARGET_H;
  const scaled = new PNG({ width: sw, height: sh });
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const srcX = Math.min(canvasW - 1, Math.floor(x / scale));
      const srcY = Math.min(canvasH - 1, Math.floor(y / scale));
      const s = (canvasW * srcY + srcX) << 2;
      const t = (sw * y + x) << 2;
      scaled.data[t] = out.data[s];
      scaled.data[t + 1] = out.data[s + 1];
      scaled.data[t + 2] = out.data[s + 2];
      scaled.data[t + 3] = out.data[s + 3];
    }
  }
  const file = path.join(outDir, `${roleId}-${POSES[i]}.png`);
  fs.writeFileSync(file, PNG.sync.write(scaled));
  console.log(`✓ ${file}  (${sw}x${sh})`);
});
console.log("完成。三张已底部对齐、同画布，可直接切换。");
