"use client"; // 这个组件后面会随状态变化，标记为客户端组件

import type { MeetingState } from "@/lib/cyber-office/types";
import { computeSeatPositions } from "@/lib/cyber-office/seats";
import { getRole } from "@/lib/cyber-office/roles";
import Character from "./character";
import SpeechBubble from "./speech-bubble";
import Cat from "./cat";

const SCENE = 340; // 场景边长（正方形）
const CENTER = SCENE / 2; // 圆心坐标（场景正中，170）
const RADIUS = 120; // 座位环半径
const CHAR = 44; // 小人方块尺寸，用于把小人"中心"对准座位点
const CHAR_W = 48; // 像素角色宽（12 格 × 4）
const CHAR_H = 56; // 像素角色高（14 格 × 4）

// 只负责"把 state 画出来"，不含任何逻辑——纯展示。
export default function OfficeScene({ state }: { state: MeetingState }) {
  // 根据参会人数算出每个座位的坐标
  const seats = computeSeatPositions(
    state.participants.length,
    RADIUS,
    CENTER,
    CENTER,
  );

  return (
    <div
      className="relative mx-auto rounded-lg border border-border bg-bg-subtle"
      style={{ width: SCENE, height: SCENE }}
    >
      {/* 木质圆桌：椭圆桌面 + 桌沿厚度 + 顶部高光 */}
      <div
        className="absolute rounded-full"
        style={{
          width: RADIUS * 1.5,
          height: RADIUS * 0.95, // 压扁成椭圆，做出俯视透视
          left: CENTER - (RADIUS * 1.5) / 2,
          top: CENTER - (RADIUS * 0.95) / 2,
          background: "#b98a52", // 木色
          boxShadow:
            "inset 0 -6px 0 #8f6538, inset 0 5px 0 #c9a06a, 0 4px 0 #6f4f2a", // 桌沿暗边 + 顶部高光 + 底部厚度
          imageRendering: "pixelated",
          zIndex: 1,
        }}
      />

      {/* 桌上的小猫，zIndex 高于桌子、低于前排小人 */}
      <div
        className="absolute"
        style={{ left: CENTER - 20, top: CENTER - 30, zIndex: 20 }}
      >
        <Cat />
      </div>

      {/* 一圈小人：遍历参会者，每个按座位坐标绝对定位 */}
      {/* .map() 把数组里每一项变成一个 JSX 元素；key 帮 React 区分谁是谁 */}
      {state.participants.map((id, i) => {
        const seat = seats[i]; // 第 i 个人的座位坐标
        const runtime = state.roles[id]; // 这个人的运行时状态（状态/气泡）
        const role = getRole(id); // 这个人的静态信息（名字/颜色）
        return (
          <div
            key={id}
            className="absolute"
            style={{
              left: seat.x - CHAR_W / 2,
              top: seat.y - CHAR_H * 0.72, // 让"脚"落在座位点，而不是几何中心
              zIndex: Math.round(seat.y), // 越靠下层级越高 → 盖住后排
            }}
          >
            {/* relative 让气泡能相对这个小人定位（气泡内部是 absolute bottom-full） */}
            <div className="relative">
              <SpeechBubble text={runtime?.bubble ?? ""} />
              <Character
                id={id}
                name={role.name}
                color={role.color}
                // ?. 和 ?? 双保险：runtime 万一不存在，就当 idle，避免崩溃
                // runtime?.status 的意思是，引擎在尝试访问 .status 之前，会先看看前面的 runtime 是否存在（是否为 null 或 undefined）。
                // A ?? B 的逻辑非常严苛。它会检查左边的 A。当且仅当左边是 null 或者 undefined 时，它才会无可奈何地使用右边的备用值 B。其他任何值（即使是空字符串 ""、数字 0 这种通常被认为是假的值），它都会坚持使用左边。
                status={runtime?.status ?? "idle"}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
