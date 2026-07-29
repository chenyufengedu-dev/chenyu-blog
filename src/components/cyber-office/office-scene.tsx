"use client"; // 随状态变化，标记为客户端组件

import type { MeetingState } from "@/lib/cyber-office/types";
import { computeSeatPositions } from "@/lib/cyber-office/seats";
import { getRole } from "@/lib/cyber-office/roles";
import Character, { CHAR_DISPLAY_H } from "./character";
import Cat from "./cat";

const SCENE = 560; // 场景边长（放大自 340）
const CENTER = SCENE / 2; // 视觉圆心 280
const RADIUS = 175; // 座位环半径
const SEAT_CY = CENTER + 15; // 座位环圆心略下移，避免顶排的头被裁掉

// 只负责“把 state 画出来”，不含任何逻辑——纯展示。
export default function OfficeScene({ state }: { state: MeetingState }) {
  // 根据参会人数算出每个座位的坐标（圆心用 SEAT_CY，比视觉中心略低）
  const seats = computeSeatPositions(
    state.participants.length,
    RADIUS,
    CENTER,
    SEAT_CY,
  );

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-lg border border-border"
      style={{
        width: SCENE,
        height: SCENE,
        maxWidth: "100%", // 窄屏时不横向溢出（等比缩放见 Task 5）
        // 固定背景：不随网站深浅色变化
        backgroundImage: "url(/cyber-office/backdrop.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 现代简约白圆桌，居中略偏下 */}
      <img
        src="/cyber-office/table.png"
        alt=""
        className="pointer-events-none absolute"
        style={{
          width: RADIUS * 1.7,
          height: "auto",
          left: CENTER - (RADIUS * 1.7) / 2,
          top: CENTER - RADIUS * 0.5,
          zIndex: 1,
        }}
      />

      {/* 桌上的小猫（zIndex 高于桌子） */}
      <div
        className="absolute"
        style={{
          left: CENTER,
          top: CENTER - RADIUS * 0.28,
          transform: "translateX(-50%)",
          zIndex: 6,
        }}
      >
        <Cat />
      </div>

      {/* 一圈角色：遍历参会者，按座位坐标绝对定位 */}
      {state.participants.map((id, i) => {
        const seat = seats[i]; // 第 i 个人的座位坐标
        const runtime = state.roles[id]; // 运行时状态（状态/气泡）
        const role = getRole(id); // 静态信息（名字/颜色）
        return (
          <div
            key={id}
            className="absolute"
            style={{
              left: seat.x,
              top: seat.y - CHAR_DISPLAY_H, // 让“脚”落在座位点
              transform: "translateX(-50%)", // 宽度不一也水平居中
              zIndex: Math.round(seat.y), // 越靠下越前，盖住后排
            }}
          >
            <Character
              id={id}
              name={role.name}
              color={role.color}
              // ?. 与 ?? 双保险：runtime 不存在就当 idle，避免崩溃
              status={runtime?.status ?? "idle"}
            />
          </div>
        );
      })}
    </div>
  );
}
