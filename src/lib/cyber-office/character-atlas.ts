import type { RoleId, RoleStatus } from "./types";

// 一张像素图谱：rows 是网格（每个字符=一种颜色的 key），palette 是 key→颜色。
// 字符 '.' 或空格 = 透明。
export interface PixelMap {
  rows: string[];
  palette: Record<string, string>;
}

// 把 hex 颜色调亮(pct>0)或调暗(pct<0)，pct 取 -1~1。
// 原理：把每个通道朝白色(255)或黑色(0)按比例混合。
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const target = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  const mix = (c: number) => Math.round(c + (target - c) * p);
  const hx = (c: number) => mix(c).toString(16).padStart(2, "0");
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

// 由角色主色生成整套调色板：肤色/发色固定，衣服三色阶由主色推导。
function buildPalette(bodyColor: string): Record<string, string> {
  return {
    h: "#6b4a2f", // 头发基色
    H: "#916b45", // 头发高光
    g: "#48311f", // 头发暗部
    s: "#e9b78e", // 皮肤基色
    w: "#f6d3ac", // 皮肤高光
    k: "#c78f68", // 皮肤暗部
    e: "#2a2333", // 眼睛
    o: "#2e2a38", // 描边
    b: bodyColor, // 衣服基色（角色主色）
    B: shade(bodyColor, 0.28), // 衣服高光
    d: shade(bodyColor, -0.28), // 衣服暗部
    c: shade(bodyColor, 0.45), // 领口
  };
}

// 共享的角色形状（12×14 起步版；每个字符对应上面调色板里的一种颜色）
const BODY_ROWS = [
  "............",
  "...hhhhhh...",
  "..hhhhhhhh..",
  "..hhsssshh..",
  "..hssssssh..",
  "..hsessesh..",
  "..hssssssh..",
  "..hsskkssh..",
  "....ssss....",
  "..bbbbbbbb..",
  "..bbbccbbb..",
  "..bbbbbbbb..",
  "..bbbbbbbb..",
  "..dddddddd..",
];

// 手臂单独成图层：垂手 / 举手 两套，切换即可，不用改身体网格。
const ARMS_DOWN = [
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  ".b........b.",
  ".b........b.",
  ".b........b.",
  ".s........s.",
  "............",
];

const ARMS_UP = [
  "............",
  "............",
  "............",
  "............",
  "..........s.",
  "..........b.",
  "..........b.",
  "..........b.",
  "..........b.",
  ".b..........",
  ".b..........",
  ".b..........",
  ".s..........",
  "............",
];

// 每个角色的"配件层"（眼镜/耳机/领带…）。起步先留空，
// 之后由总设计师逐个给你精修图谱，往这里加。
const ACCESSORIES: Partial<Record<RoleId, PixelMap>> = {};

// 把某个角色组装成"图层数组"：身体 → 手臂 →（可选）配件，后画的盖在先画的上面。
export function getCharacterLayers(
  id: RoleId,
  color: string,
  status: RoleStatus,
): PixelMap[] {
  const palette = buildPalette(color);
  const arms = status === "raising_hand" ? ARMS_UP : ARMS_DOWN;
  const accessory = ACCESSORIES[id];
  return [
    { rows: BODY_ROWS, palette },
    { rows: arms, palette },
    ...(accessory ? [accessory] : []),
  ];
}
