import type { Metadata } from "next";
import CyberOffice from "@/components/cyber-office/cyber-office";

export const metadata: Metadata = {
  title: "Cyber Office",
  description: "一个嵌入网站的多 Agent 协作实验室",
};

export default function CyberOfficePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-24">
      <CyberOffice />
    </div>
  );
}
