// 一个座位的位置信息
export interface SeatPosition {
  x: number;
  y: number;
  angle: number; // 该座位在圆周上的角度（弧度），预留给将来朝向用
}

// 把 count 个座位均匀排在以 (cx,cy) 为圆心、radius 为半径的圆周上。
// 从正上方（-90°）开始，顺时针依次排列。
export function computeSeatPositions(
  count: number,
  radius: number,
  cx: number,
  cy: number,
): SeatPosition[] {
  const seats: SeatPosition[] = [];
  for (let i = 0; i < count; i++) {
    // 第 i 个座位的角度：从 -90° 起，每个间隔 360/count 度
    const deg = -90 + (360 / count) * i;
    // 三角函数用的是弧度，所以把角度乘 π/180 转成弧度
    const angle = (deg * Math.PI) / 180;
    // 圆周上一点的坐标公式：x = 圆心x + 半径·cos(角度)，y = 圆心y + 半径·sin(角度)
    seats.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle,
    });
  }
  return seats;
}
