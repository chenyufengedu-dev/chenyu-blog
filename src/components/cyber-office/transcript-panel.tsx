"use client";

import { useState } from "react";
import type { MeetingState } from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";

export default function TranscriptPanel({ state }: { state: MeetingState }) {
  const [open, setOpen] = useState(false);
  if (state.transcript.length === 0) return null; // 没有发言就不显示

  return (
    <div className="rounded-lg border border-border bg-bg-subtle">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-text-primary">
          发言记录（{state.transcript.length}）
        </span>
        <span className="text-xs text-text-muted">
          {open ? "收起 ▲" : "展开 ▼"}
        </span>
      </button>

      {open && (
        <ol className="border-t border-border px-5 py-4">
          {state.transcript.map((turn, i) => (
            <li key={i} className="mb-3 last:mb-0">
              <p className="mb-1 text-xs font-medium text-accent">
                {i + 1}. {getRole(turn.speaker).name}
              </p>
              <p className="text-sm leading-[1.7] text-text-secondary">
                {turn.text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
