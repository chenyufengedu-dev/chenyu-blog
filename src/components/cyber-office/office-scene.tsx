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

export default function OfficeScene({
  state,
  skipToken = 0,
}: {
  state: MeetingState;
  // 每次用户点「跳过」就 +1。节奏在这一层，所以跳过也必须在这一层生效——
  // 只把剩余事件塞给状态层是没用的，显示层仍会按自己的速度慢慢播。
  skipToken?: number;
}) {
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
  // ⚠️ 关键：只有"已经吐出第一个字"的人才算接管气泡。
  // 实时模式下 host_speak / call_on / speaking_start 是同一批 SSE 到达、
  // 在同一个 tick 里全部 dispatch 的，主持人的 speaking 状态活不过一帧。
  // 如果按 speaking 状态直接切换，主持人的串场词一次都显示不出来
  //（发言记录里有、气泡里没有，就是这么来的）。
  // 所以被点名的人在开口之前，气泡仍然留给上一句——正好把模型思考的
  // 那 1~3 秒等待窗口，用来显示主持人刚说的话。
  const speakerWithText =
    speakingId && (state.roles[speakingId]?.bubble ?? "").length > 0
      ? speakingId
      : undefined;

  const lastLine = state.transcript.at(-1);
  // 会议结束后不再留着最后一句气泡：散场了画面就该干净，
  // 否则用户看着一个挂着的气泡，分不清会议是结束了还是卡住了。
  const meetingEnded = state.phase === "ended";

  // 会议状态里"此刻该显示的那句话"。注意它只是**目标**，
  // 真正显示什么由下面的节奏控制器决定。
  const targetLine = meetingEnded
    ? null
    : speakerWithText
      ? { owner: speakerWithText, text: state.roles[speakerWithText]!.bubble }
      : lastLine
        ? { owner: lastLine.speaker, text: lastLine.text }
        : null;

  // ===== 节奏控制器：整个场景唯一的"说话时钟" =====
  //
  // 为什么需要它：主持人的话是 host_speak 事件**一次性**带来全文的，
  // 而角色发言是流式逐字来的。两者速度机制不同，直接显示的话
  // 主持人会"瞬间说完"、角色却慢慢吐字，节奏完全不统一。
  //
  // 它做两件事：
  //   ① 所有人的话都按同一速度播（不管文字是怎么到达的）；
  //   ② 一句播完后**必须停顿一拍**，才允许切给下一个人 —— 真人对话里
  //      一句话说完到下一句之间总有一个呼吸的节拍，现在这个间隔是
  //      刻意留出来的，而不是"等模型回复"的副产品。
  const REVEAL_MS = 55; // 每个字的间隔。要比模型吐字更慢，才能当节拍器
  const HOLD_TICKS = 12; // 说完之后额外停顿的拍数（约 660ms）

  const [line, setLine] = useState<{ owner: RoleId; text: string } | null>(
    null,
  );
  const [shown, setShown] = useState(0);

  // 当前这句（含结尾停顿）是不是播完了
  const linePlayedOut = !line || shown >= line.text.length + HOLD_TICKS;

  // 渲染期同步目标 —— React 官方的"渲染期调整状态"写法，
  // 避开 set-state-in-effect 规则。
  if (targetLine && line && targetLine.owner === line.owner) {
    // 同一个人在继续说：文字增长立刻跟上，进度不重置
    if (targetLine.text !== line.text) setLine(targetLine);
  } else if (linePlayedOut) {
    // 换人（或散场）：必须等上一句连同停顿都播完，才允许交接。
    // 这一条就是"节拍"的来源。
    if (targetLine?.owner !== line?.owner || targetLine?.text !== line?.text) {
      setLine(targetLine);
      setShown(0);
    }
  }

  // 跳过：把当前这句直接播到底（连结尾停顿一起跳过），立刻放行下一句。
  const [prevSkip, setPrevSkip] = useState(skipToken);
  if (skipToken !== prevSkip) {
    setPrevSkip(skipToken);
    if (line) setShown(line.text.length + HOLD_TICKS);
  }

  useEffect(() => {
    if (!line) return;
    if (shown >= line.text.length + HOLD_TICKS) return;
    const timer = setTimeout(() => setShown((n) => n + 1), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [shown, line]);

  const bubbleOwner = line?.owner;
  const bubbleText = line ? line.text.slice(0, shown) : "";
  // 只有"还在吐字"才算说话；结尾那段停顿不算（那时人已经坐下、气泡驻留）
  const isRevealing = !!line && shown < line.text.length;
  // 已被点名、但还没轮到他的字出现（此时气泡还挂在上一位身上）
  const waitingToSpeak = speakingId != null && speakingId !== bubbleOwner;

  /**
   * 角色的「可见状态」——由打字进度决定，而不是直接用事件里的 status。
   * 这是让动作和文字对齐的关键：
   *   已点名但文字未到 → 举手等待（不张嘴说空话）
   *   文字正在吐      → 起身说话
   *   文字吐完        → 回到事件状态（通常是坐下），此时气泡驻留
   */
  const displayStatus = (id: RoleId): RoleStatus => {
    const raw = state.roles[id]?.status ?? "idle";

    // ① 气泡主人：只要还在吐字就保持说话姿势，吐完才回到事件状态（坐下）。
    //    这保证了"最后一个字打完"和"人坐下"必然同时发生。
    if (id === bubbleOwner) return isRevealing ? "speaking" : raw;

    // ② ⚠️ 当前这句还没说完时，其他人一律安静，不许变姿势。
    //    事件是成批到达的（host_speak / call_on / speaking_start 同一个 tick），
    //    所以被点名的人在事件层面**早就**是 raising_hand 甚至 speaking 了。
    //    若这里直接放行 raw，主持人的话才吐两个字，那人就已经举手/起身，
    //    把观众还没读到的"请产品经理"提前剧透了。
    //    这一条必须挡在 raw 之前——只堵"等待发言"那条路是不够的，
    //    raw 会从后门把 call_on 设置的姿势原样放出去。
    if (isRevealing) return "idle";

    // ③ 上一句已说完、被点名的人自己的字还没来 → 举手候场，别提前张嘴。
    if (waitingToSpeak && id === speakingId) return "raising_hand";

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
                // ⚠️ 必须跟 bubbleOwner 走，不能用事件层的 activeSpeaker。
                // 画面上的气泡/姿势/名牌都由节奏控制器决定，而 activeSpeaker 是
                // 事件层的原始值，两者经常不同步：
                //   · 主持人说话时 activeSpeaker 是 null → 谁都不虚化，没有焦点；
                //   · 主持人的气泡还挂着、事件层却已切到下一位 → 高亮的是错的人。
                dimmed={bubbleOwner != null && id !== bubbleOwner}
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
          // 同样跟 bubbleOwner 走：橙色高亮只属于"画面上正在说话的人"，
          // 而那个人的名牌已经被下一行隐掉了 —— 所以这里画出来的名牌
          // 必然都是旁听者，不该有人是橙色的。用事件层的 activeSpeaker
          // 会把还没轮到出场的下一位提前点亮。
          const active = id === bubbleOwner;
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
