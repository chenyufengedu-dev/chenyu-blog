"use client"; // 随状态变化，标记为客户端组件

import { useEffect, useRef, useState } from "react";
import type {
  MeetingState,
  RoleId,
  RoleStatus,
} from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";
import Character, { CHAR_DISPLAY_H } from "./character";
import Cat from "./cat";
import SpeechBubble from "./speech-bubble";

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

  // ===== 气泡归属：谁头顶该冒气泡、里面是什么字 =====
  // 气泡不能只绑在"正在说话"上：实时会议里模型的文字往往一整段突然到达，
  // 紧接着 speaking_end 就来了，气泡会一闪而过、根本来不及读。
  // 规则：优先跟着"正在说话的人"；没人在说时，保留"最后说完那位"的气泡，
  // 直到下一个人开口才换掉。
  const speakingId = participants.find(
    (p) => state.roles[p]?.status === "speaking",
  );
  const lastLine = state.transcript.at(-1);
  const bubbleOwner = speakingId ?? lastLine?.speaker;
  const fullText = speakingId
    ? (state.roles[speakingId]?.bubble ?? "")
    : (lastLine?.text ?? "");

  // ===== 打字机：整个场景唯一的"说话时钟" =====
  // 放在这里而不是气泡组件内部，是因为角色的动作也要跟着它走。
  // 否则会出现"人已经坐下了、头顶还在慢慢吐字"这种脱节。
  const [shown, setShown] = useState(0);
  const [prevText, setPrevText] = useState(fullText);

  // 换了新的一句（文本变短 = 上一句被清空重开）就把进度归零。
  // 用 React 官方的"渲染期调整状态"写法，避开 set-state-in-effect 规则。
  if (fullText !== prevText) {
    setPrevText(fullText);
    if (fullText.length < prevText.length) setShown(0);
  }

  useEffect(() => {
    if (shown >= fullText.length) return;
    const timer = setTimeout(() => setShown((n) => n + 1), 24);
    return () => clearTimeout(timer);
  }, [shown, fullText]);

  const isRevealing = shown < fullText.length; // 还在吐字
  const waitingForText = speakingId != null && fullText.length === 0; // 已点名，模型还在想
  const bubbleText = waitingForText ? "···" : fullText.slice(0, shown);

  /**
   * 角色的「可见状态」——由打字进度决定，而不是直接用事件里的 status。
   * 这是让动作和文字对齐的关键：
   *   已点名但文字未到 → 举手等待（不张嘴说空话）
   *   文字正在吐      → 起身说话
   *   文字吐完        → 回到事件状态（通常是坐下），此时气泡驻留
   */
  const displayStatus = (id: RoleId): RoleStatus => {
    const raw = state.roles[id]?.status ?? "idle";
    if (id !== bubbleOwner) return raw;
    if (waitingForText) return "raising_hand";
    if (isRevealing) return "speaking";
    return raw;
  };

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
        className="relative select-none overflow-hidden rounded-lg border border-border"
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
          const role = getRole(id);
          // 用"可见状态"而不是事件里的原始状态，保证动作和气泡文字同步
          const status = displayStatus(id);
          // 近侧角色(i>=3)一旦站起来发言，就整个人提到"前桌沿"之上，避免被桌沿横切穿模；
          // 坐着时仍在桌沿之下（膝盖被前桌沿盖住）。
          const isNear = i >= 3;
          const standingSpeak = status === "speaking";
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
                status={status}
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
          // ① 头顶正挂着气泡的人，名字已经写在气泡里了，这里不再画浮动名牌。
          //    注意要跟"气泡归属"一致而不是只看 speaking——气泡在发言结束后
          //    还会驻留一会儿，那期间名牌若冒出来就会和气泡撞在一起。
          if (id === bubbleOwner) return null;

          // ② 场上有没有人在说话。不能只看 activeSpeaker——
          //    主持人串场时 activeSpeaker 是 null，但他确实在说话。
          const someoneElseSpeaking = bubbleOwner != null;
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
                opacity: someoneElseSpeaking ? 0.25 : 1,
                transition: "opacity .35s ease",
                zIndex: 400,
              }}
            >
              {getRole(id).name}
            </span>
          );
        })}

        {/* 发言气泡层：同一时刻只有一个气泡。放在最顶层，盖过桌沿和名字。
            主持人串场时同样有气泡——因为 reducer 也把 host 设成了 speaking。 */}
        {(() => {
          if (!bubbleOwner) return null;

          const seat = SEATS[participants.indexOf(bubbleOwner)];
          if (!seat) return null;

          // 角色实际显示高度（含近大远小的缩放），用来算头顶位置
          const charH = CHAR_DISPLAY_H * seatScale(seat.y);

          return (
            <SpeechBubble
              // key 换人时重新挂载，气泡里的打字进度自然归零
              key={bubbleOwner}
              name={getRole(bubbleOwner).name}
              text={bubbleText}
              x={seat.x}
              y={seat.y - charH - 8} // 头顶再往上留 8px
            />
          );
        })()}
      </div>
    </div>
  );
}
