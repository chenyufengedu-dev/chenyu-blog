"use client"; // 随状态变化，标记为客户端组件

import type { MeetingState } from "@/lib/cyber-office/types";
import { computeSeatPositions } from "@/lib/cyber-office/seats";
import { getRole } from "@/lib/cyber-office/roles";
import Character, { CHAR_DISPLAY_H } from "./character";
import Cat from "./cat";

const SCENE = 560; // 场景边长（正方形）
const CENTER = SCENE / 2; // 视觉圆心 280

// 桌子尺寸（现代简约白圆桌）
const TABLE_W = 280;
const TABLE_H = TABLE_W * 0.84; // 按 table.png 原生比例（≈235）
const TABLE_CY = 292; // 桌子中心 y，略高于场景中心，给下方留点空间

// 座位不是正圆，而是「横宽竖扁」的椭圆——贴合俯视圆桌的透视，
// 让人真正围在桌边，而不是散在一个大圆上。
const RING_CX = CENTER; // 椭圆中心 x
const RING_CY = 300; // 椭圆中心 y
const RING_RX = 208; // 椭圆横半径（宽）
const RING_RY = 116; // 椭圆纵半径（扁）

export default function OfficeScene({ state }: { state: MeetingState }) {
  // 只借用 computeSeatPositions 算出的角度；坐标我们自己按椭圆算，
  // 所以半径/圆心传占位值 1,0,0 即可。
  const seats = computeSeatPositions(state.participants.length, 1, 0, 0);

  return (
    // 外层：窄屏可横向滚动，不撑破整页
    <div className="mx-auto w-fit max-w-full overflow-x-auto">
      <div
        className="relative overflow-hidden rounded-lg border border-border"
        style={{
          width: SCENE,
          height: SCENE,
          // 固定背景：不随网站深浅色变化
          backgroundImage: "url(/cyber-office/backdrop.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* 薄蒙版：压一下过亮的背景，让前景角色更跳（不随主题变） */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "rgba(248,247,244,0.14)", zIndex: 0 }}
        />

        {/* 现代简约白圆桌 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 精灵图需按原样显示，next/image 会重编码糊掉像素 */}
        <img
          src="/cyber-office/table.png"
          alt=""
          className="pointer-events-none absolute"
          style={{
            width: TABLE_W,
            height: TABLE_H,
            left: CENTER - TABLE_W / 2,
            top: TABLE_CY - TABLE_H / 2,
            // 桌子层级设在前后排之间：后排(py<桌中心)画在桌后，前排画在桌前
            zIndex: Math.round(TABLE_CY),
          }}
        />

        {/* 桌上的小猫（永远在桌面之上） */}
        <div
          className="absolute"
          style={{
            left: CENTER,
            top: TABLE_CY - 48,
            transform: "translateX(-50%)",
            zIndex: Math.round(TABLE_CY) + 2,
          }}
        >
          <Cat />
        </div>

        {/* 一圈角色：按椭圆座位坐标绝对定位 */}
        {state.participants.map((id, i) => {
          const angle = seats[i].angle; // 该座位在环上的角度
          const px = RING_CX + RING_RX * Math.cos(angle); // 椭圆横向铺开
          const py = RING_CY + RING_RY * Math.sin(angle); // 椭圆纵向压扁
          const runtime = state.roles[id];
          const role = getRole(id);
          return (
            <div
              key={id}
              className="absolute"
              style={{
                left: px,
                top: py - CHAR_DISPLAY_H, // 让“脚”落在座位点
                transform: "translateX(-50%)", // 宽度不一也水平居中
                // 越靠下(前排)层级越高：盖住后排；也让前排在桌前、后排在桌后
                zIndex: Math.round(py),
              }}
            >
              <Character
                id={id}
                name={role.name}
                // ?. 与 ?? 双保险：runtime 不存在就当 idle，避免崩溃
                status={runtime?.status ?? "idle"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
