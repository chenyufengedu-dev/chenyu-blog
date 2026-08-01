# Cyber Office 美术资产规格（角色 / 桌子 / 帧）

> 视觉优先、缺什么补什么。本文件是"生成素材照着做"的规格与 prompt 集中地（美术轨）。
> 交互代码走 [`2026-07-31-cyber-office-experience-tasks.md`](./2026-07-31-cyber-office-experience-tasks.md)。

## 铁律

1. **椅子归角色，不归桌子。** 桌子重做成**无椅版**（圆桌 + 桌面道具）；每个角色精灵**自带自己的椅子**。
2. **站起来后椅子还在。** 角色的"起身/发言"帧里，**空椅子仍画在原位**（人站在椅子前/旁）。
3. **听按座位朝向、发言转正面。** 近侧的人平时背对/侧对我们（真围坐），轮到发言转过来正面汇报。
4. **风格统一**：cozy 像素插画、软阴影、限色、subtle outline，与背景/桌子同一套。
5. **每角色所有帧同一个人、同尺寸画布、脚在同一基线**（切换不跳）。

## 座位 → 朝向（5 人）

| 角色 | 座位 | 听（坐）朝向 | 发言（起身）朝向 |
|---|---|---|---|
| 主持人 host | 远侧中 | 正面 | 正面 |
| 产品经理 pm | 远侧左 | ¾正面(右转) | 正面 |
| 前端 frontend | 远侧右 | ¾正面(左转) | 正面 |
| 生信 bio | 近侧左 | **¾背面(右转)** | **转正面** |
| 审稿人 reviewer | 近侧右 | **¾背面(左转)** | **转正面** |

## 每角色的帧（先做核心，后加流畅帧）

**核心 3 帧**（每帧都含**自己的椅子**）：
- `sitting`：坐在椅子上（听），按上表"听朝向"。
- `raising`：坐着举一只手过头（近侧的人可在此帧开始转身）。
- `standing`：从椅子起身、**空椅子仍在身后/旁**，正面朝我们、张嘴说话。

**流畅增强帧（可选，做了更好看）**：
- `talking2`：站立说话的第二张口型（与 `standing` 交替循环 → 说话动画）。
- `turning`：近侧角色 ¾背面 → 正面 的中间过渡帧（让"转身"顺滑，不是啪一下跳）。
- idle 呼吸/眨眼：用 CSS + 可选 1 张眨眼帧。

> **不同角色动作可不同**：主持人摊手欢迎、审稿人举红笔点、产品经理比划介绍、生信推眼镜等——鼓励差异化，别千篇一律。

## 出图 prompt

风格锚（每段都带）：
```
cozy pixel art illustration, soft shading, muted neutral palette, subtle outline, consistent lighting, no photo realism, no text
```

> ⚠️ **背景必须用绿幕**：角色/桌子一律画在 `SOLID pure chroma-key green background (#00b140), NO shadow on the ground` 上——灰底和白大褂/灰椅太像，抠不干净会留灰边和投影；绿幕才能一键抠净。
> ⚠️ **尺寸必须统一**：同一张图里 `all poses at the SAME size, the SAME head size, standing on the same ground line`；不同角色也尽量同样大（否则拼进场景头有大有小）。
> 脚本 `split-poses.mjs` 已内置绿幕识别：四角是绿色时自动键出绿色。
> ⚠️ **7 帧之间必须留明显间隔**：帧与帧之间要有**清晰的整条绿色空隙**，每帧的手臂/道具**不要越到隔壁帧**——否则切图器分不出边界，会把内容切到隔壁。prompt 里强调 `evenly spaced with clear wide green gaps between each pose, each pose fully within its own column, arms not crossing into the gaps`。
> 脚本已做兜底（检测不到间隔时改等分硬切），但**等分会误切**，务必靠间距从源头避免。

**角色（一次出一整排该角色的 7 帧）**：
```
Seven poses of the SAME single character in one image, evenly spaced left-to-right on a SOLID pure chroma-key green background (#00b140) with NO ground shadow, ALL poses at the SAME size and the SAME head size, standing on the same ground line, each pose INCLUDING the SAME office chair:
pose 1 (idle rest) sitting on the office chair calmly, <听朝向>;
pose 2 (idle action, start) sitting, <待机动作> starting, <听朝向>;
pose 3 (idle action, peak) sitting, <待机动作> at its peak, <听朝向>;
pose 4 (blink) EXACTLY the same as pose 1 but with the EYES CLOSED, <听朝向>;
pose 5 (raising hand) sitting, raising ONE hand above the head, <听朝向>;
pose 6 (speaking, mouth CLOSED) standing up STRAIGHT IN PLACE with the empty chair DIRECTLY BEHIND (do NOT step aside, do NOT move sideways), FACING THE VIEWER, same body width and head size as pose 1, mouth closed, <发言手势>;
pose 7 (speaking, mouth OPEN) EXACTLY the same as pose 6 but MOUTH OPEN as if talking (only the mouth differs), <发言手势>;
Character: <角色描述>. Keep face/hair/clothes/colors and the chair identical across all poses. cozy pixel art illustration, soft shading, muted neutral palette, subtle outline, consistent lighting, no photo realism. No text.
```
- `<听朝向>`：host `facing viewer`；pm `three-quarter front turned right`；frontend `three-quarter front turned left`；bio `three-quarter back view seen from behind, turned right`；reviewer `three-quarter back view seen from behind, turned left`。
- `<待机动作>`（**个性化，赋予生命力**）：host `lifting a coffee mug toward the mouth to take a sip`；pm `looking down at a tablet and nodding`；frontend `adjusting the headphones with one hand`；bio `looking down and writing in a small notebook`；reviewer `tapping a red pen on a notebook`。
- `<发言手势>`（差异化）：host `welcoming open-hand gesture`；pm `presenting gesture`；frontend `pointing at an imaginary screen`；bio `pushing glasses`；reviewer `holding up a red pen`。
- `<角色描述>`：host `a female facilitator with a headset, shoulder-length brown hair, beige blazer, lanyard`；pm `a male product manager, white shirt with blue tie, short brown hair`；frontend `a male engineer in a dark gray hoodie with headphones, black hair`；bio `a female researcher, long black hair, round glasses, white lab coat over blue shirt`；reviewer `a male reviewer with glasses, dark sweater, khaki trousers`。

**桌子（无椅版，重做）**：

```
A modern round office meeting table, 3/4 top-down view, matte light-gray top with a few props (notebook, papers, coffee cup), simple minimalist pedestal base, NO chairs. [风格锚]. isolated on a SOLID pure chroma-key green background (#00b140), no shadow.
```

## 流水线

1. 每角色出一张多帧大图 → 存 `public/sprites/_src/<id>-poses.png`。
2. 跑 `node scripts/split-poses.mjs public/sprites/_src/<id>-poses.png <id> 340 sitting,act1,act2,blink,raising,standing,talking` 切齐去底（7 帧）。
3. 桌子无椅版 → `node scripts/cutout.mjs public/sprites/_src/table.png public/cyber-office/table.png 300`。
4. 总设计师按座位把角色摆到桌子四周（含近大远小、前后遮挡、发言转正面接线）。

## 先验证再批量

先出 **生信（近侧：¾背面→转正面，最难）** + **主持人（远侧正面，基准）** 两张多帧图，切图接进场景确认朝向/椅子/比例，再批量其余三个。
