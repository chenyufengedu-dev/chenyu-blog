import type { Metadata } from "next";
import CyberOffice from "@/components/cyber-office/cyber-office";

export const metadata: Metadata = {
  title: "Cyber Office | Chenyu",
  description: "一个嵌入网站的多 Agent 协作实验室",
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
      <CyberOffice />
    </div>
  );
}
