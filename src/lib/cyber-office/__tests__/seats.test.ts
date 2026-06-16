import { describe, it, expect } from "vitest";
import { computeSeatPositions } from "@/lib/cyber-office/seats";

describe("computeSeatPositions", () => {
  it("返回与人数相同数量的座位", () => {
    // 5 个人、半径 100、圆心 (170,170)
    const seats = computeSeatPositions(5, 100, 170, 170);
    expect(seats).toHaveLength(5); // 应当返回 5 个座位
  });

  it("第一个座位在正上方（圆心正上 radius 处）", () => {
    const seats = computeSeatPositions(4, 100, 170, 170);
    // 起始角度 -90°（正上方）：x 不变 ≈170，y 比圆心高 radius ≈170-100=70
    // 💡 toBeCloseTo 用于浮点数比较（避免 0.0000001 误差），第二个参数是精度
    expect(seats[0].x).toBeCloseTo(170, 5);
    expect(seats[0].y).toBeCloseTo(70, 5);
  });

  it("座位均匀分布（4 人时第二个在正右方）", () => {
    const seats = computeSeatPositions(4, 100, 170, 170);
    // 4 个人每隔 90°，第二个在正右方：x ≈170+100=270，y ≈170
    expect(seats[1].x).toBeCloseTo(270, 5);
    expect(seats[1].y).toBeCloseTo(170, 5);
  });
});
