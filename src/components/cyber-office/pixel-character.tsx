import type { RoleStatus } from "@/lib/cyber-office/types";

// 所有角色共用的肤色/发色/眼睛色；只有"衣服"用角色自己的 color，做出区分。
const SKIN = "#f1c9a5";
const HAIR = "#3a2e28";
const EYE = "#222222";

// 一个 SVG 像素小人。viewBox 是 16×20 的像素网格，每个 <rect> 就是若干像素块。
export default function PixelCharacter({
  color,
  status,
}: {
  color: string;
  status: RoleStatus;
}) {
  const raising = status === "raising_hand"; // 举手时右臂抬高

  return (
    <svg
      width={40}
      height={50}
      viewBox="0 0 16 20"
      shapeRendering="crispEdges" // 关键：像素边缘不抗锯齿，保持锐利
      style={{ imageRendering: "pixelated" }}
      role="img"
      aria-hidden // 名字标签已表达身份，SVG 本身对读屏无额外信息
    >
      {/* 头发 */}
      <rect x={4} y={1} width={8} height={3} fill={HAIR} />
      {/* 脸 */}
      <rect x={5} y={3} width={6} height={5} fill={SKIN} />
      {/* 眼睛（两个 1×1 像素） */}
      <rect x={6} y={5} width={1} height={1} fill={EYE} />
      <rect x={9} y={5} width={1} height={1} fill={EYE} />
      {/* 身体：用角色色，这就是每个角色的视觉区分 */}
      <rect x={4} y={8} width={8} height={7} fill={color} />
      {/* 左臂 + 左手 */}
      <rect x={3} y={8} width={1} height={5} fill={color} />
      <rect x={3} y={13} width={1} height={1} fill={SKIN} />
      {/* 右臂：举手时整条抬到头顶高度，否则自然下垂 */}
      {raising ? (
        <>
          <rect x={12} y={3} width={1} height={5} fill={color} />
          <rect x={12} y={2} width={1} height={1} fill={SKIN} />
        </>
      ) : (
        <>
          <rect x={12} y={8} width={1} height={5} fill={color} />
          <rect x={12} y={13} width={1} height={1} fill={SKIN} />
        </>
      )}
    </svg>
  );
}
