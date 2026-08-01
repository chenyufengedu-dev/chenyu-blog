"use client"; // 随状态变化，标记为客户端组件

import { useEffect, useRef, useState } from "react";
import type { MeetingState, RoleId } from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";
import Character, { CHAR_DISPLAY_H } from "./character";
import Cat from "./cat";

// 设计画布（内部按这套坐标画，再整体等比缩放去适配列宽）
const SCENE_W = 760;
const SCENE_H = 480;

// 无椅圆桌（553×300）作为中心；椅子在各角色精灵里，桌子不再带椅
const TABLE_W = 310; // 收窄一点，侧边不挤到近侧角色
const TABLE_H = Math.round((TABLE_W * 300) / 553); // ≈168
const TABLE_CX = SCENE_W / 2; // 380
const TABLE_CY = 335;
const TABLE_LEFT = TABLE_CX - TABLE_W / 2;
const TABLE_TOP = TABLE_CY - TABLE_H / 2;

// 每个座位的"脚/椅子底"落点（设计坐标），顺序对应参会者顺序。
// 远侧（上，y 小）在桌后、被桌挡；近侧（下，y 大）在桌前。
const SEATS: { x: number; y: number }[] = [
  { x: 380, y: 284 }, // 远侧中（桌头）—— host（下移贴桌）
  { x: 236, y: 320 }, // 远侧左 —— pm（往里贴桌沿）
  { x: 524, y: 320 }, // 远侧右 —— frontend
  { x: 226, y: 432 }, // 近侧左 —— bio
  { x: 534, y: 432 }, // 近侧右 —— reviewer
  { x: 380, y: 450 }, // 近侧中 —— recorder（第 6 人）
];

const DEFAULT_PARTICIPANTS: RoleId[] = [
  "host",
  "pm",
  "frontend",
  "bio",
  "reviewer",
];

// 近大远小：越靠下（y 越大）越大
const seatScale = (y: number) => 0.62 + (y / SCENE_H) * 0.6;

export default function OfficeScene({ state }: { state: MeetingState }) {
  const participants =
    state.participants.length > 0 ? state.participants : DEFAULT_PARTICIPANTS;

  // 响应式：整体等比缩放到列宽，避免固定宽度横向滚动
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / SCENE_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="mx-auto w-full"
      style={{ maxWidth: SCENE_W, height: SCENE_H * scale }}
    >
      <div
        className="relative overflow-hidden rounded-lg border border-border"
        style={{
          width: SCENE_W,
          height: SCENE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundImage: "url(/cyber-office/backdrop.png)",
          backgroundSize: "cover",
          backgroundPosition: "center top", // 顶对齐：完整露出窗户，裁掉的是下方地板
        }}
      >
        {/* 薄蒙版：压一下背景，让前景角色更跳 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "rgba(248,247,244,0.1)", zIndex: 0 }}
        />

        {/* 无椅圆桌 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 精灵图需按原样显示，next/image 会重编码糊掉像素 */}
        <img
          src="/cyber-office/table.png"
          alt=""
          className="pointer-events-none absolute"
          style={{
            width: TABLE_W,
            height: TABLE_H,
            left: TABLE_LEFT,
            top: TABLE_TOP,
            zIndex: Math.round(TABLE_CY), // 前后排以桌子分界
          }}
        />

        {/* 桌上小猫 */}
        <div
          className="absolute"
          style={{
            left: TABLE_CX,
            top: TABLE_CY - 40, // 桌面正中偏上一点
            transform: "translateX(-50%)",
            zIndex: Math.round(TABLE_CY) + 1,
          }}
        >
          <Cat />
        </div>

        {/* 角色（自带椅子）：坐到桌子四周，近大远小、前后遮挡 */}
        {participants.map((id, i) => {
          const seat = SEATS[i];
          if (!seat) return null;
          const k = seatScale(seat.y);
          const runtime = state.roles[id];
          const role = getRole(id);
          // 近侧角色(i>=3)一旦站起来发言，就整个人提到"前桌沿"之上，避免被桌沿横切穿模；
          // 坐着时仍在桌沿之下（膝盖被前桌沿盖住）。
          const isNear = i >= 3;
          const standingSpeak = runtime?.status === "speaking";
          const z = isNear && standingSpeak ? 500 : Math.round(seat.y);
          return (
            <div
              key={id}
              className="absolute"
              style={{
                left: seat.x,
                top: seat.y - CHAR_DISPLAY_H,
                transform: `translateX(-50%) scale(${k})`,
                transformOrigin: "bottom center",
                zIndex: z,
              }}
            >
              <Character
                id={id}
                name={role.name}
                status={runtime?.status ?? "idle"}
                showName={false}
                dimmed={
                  state.activeSpeaker != null && state.activeSpeaker !== id
                }
              />
            </div>
          );
        })}

        {/* 桌子"前桌沿"再叠一层在近侧角色之上：盖住近侧两人的膝盖，露出上半身。
            用 clipPath 只显示桌子图的下半部分（前沿），position/size 与桌子完全一致。 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 精灵图需按原样显示 */}
        <img
          src="/cyber-office/table.png"
          alt=""
          className="pointer-events-none absolute"
          style={{
            width: TABLE_W,
            height: TABLE_H,
            left: TABLE_LEFT,
            top: TABLE_TOP,
            clipPath: "inset(62% 0 0 0)", // 只保留下 38%（前桌沿只盖膝盖，不切到肩膀）
            zIndex: 430, // 高于近侧角色，盖住其膝盖
          }}
        />

        {/* 名字：独立顶层，永远可见。远侧(前3人)放头顶上方(脚下会被桌子挡)，近侧放脚下 */}
        {participants.map((id, i) => {
          const seat = SEATS[i];
          if (!seat) return null;
          const active = state.activeSpeaker === id;
          const someoneElseSpeaking =
            state.activeSpeaker != null && !active;
          const isFar = i < 3; // 远侧三人
          const charH = CHAR_DISPLAY_H * seatScale(seat.y);
          const nameY = isFar ? seat.y - charH - 6 : seat.y + 6;
          return (
            <span
              key={`name-${id}`}
              className="absolute -translate-x-1/2 whitespace-nowrap rounded bg-background/80 px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                left: seat.x,
                top: nameY,
                color: active ? "#ea580c" : "var(--text-muted)",
                // 别人发言时，非发言者名字也一起变淡，不做无主悬浮标签
                opacity: someoneElseSpeaking ? 0.5 : 1,
                transition: "opacity .35s ease",
                zIndex: 400,
              }}
            >
              {getRole(id).name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
