"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import type { ComponentPropsWithoutRef, PointerEvent, WheelEvent } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type PanPosition = {
  x: number;
  y: number;
};

export default function MdxImage(props: ComponentPropsWithoutRef<"img">) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanPosition>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // dragStartRef 用来记录拖拽开始时的鼠标位置和图片偏移量。
  // 用 ref 而不是 state，是因为拖拽过程中它只作为计算基准，不需要触发渲染。
  const dragStartRef = useRef({
    pointerX: 0,
    pointerY: 0,
    panX: 0,
    panY: 0,
  });

  const src = typeof props.src === "string" ? props.src : undefined;
  const alt = props.alt || "文章图片";

  const closePreview = useCallback(() => {
    setOpen(false);
    // 关闭时重置缩放和位移，避免下次打开还是上一次的查看位置
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((current) => {
      const nextZoom = Math.max(MIN_ZOOM, current - ZOOM_STEP);

      // 如果已经缩回 100%，图片回到中心位置。
      // 这样不会出现“图片没放大却还偏在一边”的奇怪状态。
      if (nextZoom === MIN_ZOOM) {
        setPan({ x: 0, y: 0 });
      }

      return nextZoom;
    });
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = (event: WheelEvent<HTMLSpanElement>) => {
    // 阻止默认滚动：滚轮不再推动背后的博客正文
    event.preventDefault();

    // 阻止事件冒泡：滚轮只在图片预览层里处理
    event.stopPropagation();

    if (event.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLImageElement>) => {
    event.stopPropagation();

    // 只有放大后才需要拖动。
    // 100% 状态下拖动图片意义不大，也容易误触。
    if (zoom <= 1) return;

    setDragging(true);

    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };

    // setPointerCapture 的作用：
    // 鼠标按住图片后，即使移动得很快、短暂离开图片区域，
    // 后续 pointermove 仍然会继续发给这张图片，拖拽不会断。
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLImageElement>) => {
    if (!dragging || zoom <= 1) return;

    event.stopPropagation();

    const deltaX = event.clientX - dragStartRef.current.pointerX;
    const deltaY = event.clientY - dragStartRef.current.pointerY;

    setPan({
      x: dragStartRef.current.panX + deltaX,
      y: dragStartRef.current.panY + deltaY,
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLImageElement>) => {
    if (!dragging) return;

    event.stopPropagation();
    setDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    if (!open) return;

    // 打开图片预览时锁住背后的页面滚动。
    // 否则即使预览层是 fixed，底层 blog 页面仍然可能响应滚轮。
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }

      // 键盘快捷键：+ 放大，- 缩小，0 复位
      if (event.key === "+" || event.key === "=") {
        zoomIn();
      }

      if (event.key === "-") {
        zoomOut();
      }

      if (event.key === "0") {
        resetView();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePreview, open, resetView, zoomIn, zoomOut]);

  return (
    <>
      {/* 
        文章内图片容器：
        - my-1 控制图片块和上下正文之间的距离
        - p-1 / md:p-2 控制图框内部四周留白
        - overflow-hidden + rounded-lg 让图片和边框圆角一致

        not-prose 是关键：
        当前文章正文外层用了 prose，Typography 插件会自动给 img 加 margin: 32px 0。
        not-prose 可以告诉 Typography：“这块区域不要接管样式”。
      */}
      <span className="not-prose my-1 block overflow-hidden rounded-lg border border-border bg-bg-subtle p-1 md:p-2">
        <button
          type="button"
          onClick={() => src && setOpen(true)}
          className="block w-full cursor-zoom-in text-left"
          aria-label="放大查看图片"
        >
          {/* 
            m-0 是关键：
            Typography 插件会默认给 prose img 添加 margin，
            这里强制清掉，避免图片上下多出一层默认空白。

            !m-0 是双保险：
            即使某些情况下 prose 样式仍然影响到图片，也强制清掉 img 自己的默认上下 margin。
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...props}
            alt={alt}
            className="!m-0 block w-full rounded-md"
            loading="lazy"
          />
        </button>
      </span>

      {open && src && (
        <span
          className="fixed inset-0 z-[120] flex flex-col bg-black/85 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={closePreview}
          onWheel={handleWheel}
        >
          {/* 顶部工具栏 */}
          <span className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 text-white">
            <span className="font-mono text-[12px] text-white/60">
              {Math.round(zoom * 100)}%
            </span>

            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  zoomOut();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={zoom <= MIN_ZOOM}
                aria-label="缩小图片"
              >
                <Minus size={17} />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  resetView();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="重置缩放和位置"
              >
                <RotateCcw size={16} />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  zoomIn();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={zoom >= MAX_ZOOM}
                aria-label="放大图片"
              >
                <Plus size={17} />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closePreview();
                }}
                className="ml-2 flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="关闭图片预览"
              >
                <X size={18} />
              </button>
            </span>
          </span>

          {/* 
            图片查看区域：
            - overflow-hidden 避免放大后的图片把页面撑出滚动条
            - 点击黑色背景关闭
            - 点击或拖动图片本身不关闭
          */}
          <span className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 md:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className={`max-h-[85vh] max-w-[92vw] select-none object-contain ${
                zoom > 1
                  ? dragging
                    ? "cursor-grabbing"
                    : "cursor-grab"
                  : "cursor-zoom-in"
              }`}
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </span>
        </span>
      )}
    </>
  );
}
