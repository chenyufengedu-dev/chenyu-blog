import type { Metadata } from "next";
import type { MeetingState } from "@/lib/cyber-office/types";
import OfficeScene from "@/components/cyber-office/office-scene";

export const metadata: Metadata = {
  title: "Cyber Office | Chenyu",
  description: "一个嵌入网站的多 Agent 协作实验室",
};

// P0 临时静态状态：所有人 idle，只为把场景画出来。P1 会换成真实回放状态。
const staticState: MeetingState = {
  phase: "idle",
  topic: "",
  participants: ["host", "pm", "frontend", "bio", "reviewer", "recorder"],
  roles: {
    host: { id: "host", status: "idle", bubble: "" },
    pm: { id: "pm", status: "idle", bubble: "" },
    frontend: { id: "frontend", status: "idle", bubble: "" },
    bio: { id: "bio", status: "idle", bubble: "" },
    reviewer: { id: "reviewer", status: "idle", bubble: "" },
    recorder: { id: "recorder", status: "idle", bubble: "" },
  },
  activeSpeaker: null,
  hostText: "",
  summary: null,
  error: null,
};

export default function CyberOfficePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 md:px-8 md:py-24">
      <header className="mb-12">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          Cyber Office
        </h1>
        <p className="text-lg leading-[1.7] text-text-secondary">
          一个嵌入网站的多 Agent
          协作实验室。给一个议题，角色们围坐圆桌轮流发言、由主持人调度，最后产出结论。
        </p>
      </header>
      <OfficeScene state={staticState} />
    </div>
  );
}
