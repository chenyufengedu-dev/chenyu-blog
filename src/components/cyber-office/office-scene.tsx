"use client"; // 随状态变化，标记为客户端组件

import type { MeetingState, RoleId } from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";
import Character, { CHAR_DISPLAY_H } from "./character";
import Cat from "./cat";

// 画幅：扁一点，像会议室的横向大银幕，而不是正方形
const SCENE_W = 680;
const SCENE_H = 430;

// 桌子（现代简约白圆桌）作为前景，靠下、偏大——近大远小
const TABLE_W = 300;
const TABLE_H = TABLE_W * 0.84; // 按 table.png 原生比例（≈252）
const TABLE_CX = SCENE_W / 2; // 340
const TABLE_CY = 300; // 桌子中心 y（靠下，前景）

// 角色只排在桌子的「远侧 + 两侧」半圈，近侧（底部）留空 = 观众/我们的位置。
// 这样每个人都是隔着桌子朝我们坐，正面精灵图才合理；下半身被桌子挡住，不需要画凳子。
const ARC_CX = TABLE_CX; // 半圆中心 x
const ARC_CY = 258; // 半圆中心 y（比桌子略高，人坐在桌后）
const ARC_RX = 250; // 横向铺开半径
const ARC_RY = 96; // 纵向压扁半径
const ARC_START = 205; // 起始角度（度）——远侧左
const ARC_END = 335; // 结束角度（度）——远侧右

// 默认参会者：首次进页面（还没点播放）也让桌旁坐满人，不空场。
const DEFAULT_PARTICIPANTS: RoleId[] = [
  "host",
  "pm",
  "frontend",
  "bio",
  "reviewer",
];

export default function OfficeScene({ state }: { state: MeetingState }) {
  // 没有正在进行的会议时，用默认名单把座位坐满（都当 idle）
  const participants =
    state.participants.length > 0 ? state.participants : DEFAULT_PARTICIPANTS;
  const n = participants.length;
  const denom = Math.max(1, n - 1); // 防止 n=1 时除以 0

  return (
    // 外层：窄屏可横向滚动，不撑破整页
    <div className="mx-auto w-fit max-w-full overflow-x-auto">
      <div
        className="relative overflow-hidden rounded-lg border border-border"
        style={{
          width: SCENE_W,
          height: SCENE_H,
          // 固定背景：不随网站深浅色变化
          backgroundImage: "url(/cyber-office/backdrop.png)",
          backgroundSize: "cover",
          backgroundPosition: "center 28%",
        }}
      >
        {/* 薄蒙版：压一下过亮的背景，让前景角色更跳 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "rgba(248,247,244,0.16)", zIndex: 0 }}
        />

        {/* 角色：远侧半圈，隔桌朝向我们 */}
        {participants.map((id, i) => {
          const deg = ARC_START + ((ARC_END - ARC_START) * i) / denom;
          const rad = (deg * Math.PI) / 180;
          const px = ARC_CX + ARC_RX * Math.cos(rad); // 横向铺开
          const py = ARC_CY + ARC_RY * Math.sin(rad); // 纵向压扁
          const runtime = state.roles[id];
          const role = getRole(id);
          return (
            <div
              key={id}
              className="absolute"
              style={{
                left: px,
                top: py - CHAR_DISPLAY_H, // 脚落在座位点
                transform: "translateX(-50%)",
                // 都在桌子之后（zIndex 低于桌子），下半身被桌子前景挡住
                zIndex: Math.round(py),
              }}
            >
              <Character
                id={id}
                name={role.name}
                status={runtime?.status ?? "idle"}
                dimmed={
                  state.activeSpeaker != null && state.activeSpeaker !== id
                }
              />
            </div>
          );
        })}

        {/* 桌子（前景，盖住角色下半身，形成"围坐"纵深） */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 精灵图需按原样显示，next/image 会重编码糊掉像素 */}
        <img
          src="/cyber-office/table.png"
          alt=""
          className="pointer-events-none absolute"
          style={{
            width: TABLE_W,
            height: TABLE_H,
            left: TABLE_CX - TABLE_W / 2,
            top: TABLE_CY - TABLE_H / 2,
            zIndex: 300, // 高于所有角色（角色 py 最大约 210）
          }}
        />

        {/* 桌上的小猫（在桌面之上） */}
        <div
          className="absolute"
          style={{
            left: TABLE_CX,
            top: TABLE_CY - 40,
            transform: "translateX(-50%)",
            zIndex: 302,
          }}
        >
          <Cat />
        </div>
      </div>
    </div>
  );
}
