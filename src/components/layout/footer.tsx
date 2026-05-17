import Link from "next/link";
import { Mail } from "lucide-react";
import { FaGithub, FaTwitter } from "react-icons/fa";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    // border-t：只在顶部（Top）画一条 1px 的横线。
    <footer className="mt-16 border-t border-border/50 py-8 transition-colors">
      {/* flex flex-col：开启弹性盒子，并强制内部元素从上往下垂直排列（Column）。
       items-center：把这些垂直排列的元素全部水平居中对齐。
       gap-6：上下元素之间保持 24px 的间距。
       md:flex-row：打破垂直排列，立刻变成水平并排（Row）
       md:justify-between：既然并排了，就把它们推向两端。版权信息顶在最左边，社交图标顶在最右边，中间彻底掏空（就像跷跷板的两头）。*/}
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 md:flex-row md:justify-between md:px-8">
        {/* 左侧组：品牌标识、版权与描述（横向紧凑排列）*/}
        <div className="flex flex-col items-center gap-2 text-sm text-text-subtle md:flex-row md:gap-3">
          <span className="font-medium text-text-secondary">Chenyu</span>
          {/* h-3 (Height)：高度设为 3 个单位（12px）
          w-px (Width)：宽度设为 1 像素 
          手机端（默认状态）：hidden
          电脑端：md:block 瞬间触发，把这条原本隐藏的线变成块级元素（block）显示出来，完美地插在文字之间*/}
          <span className="hidden h-3 w-px bg-border/80 md:block" />
          <span>© {currentYear} All rights reserved.</span>
          <span className="hidden h-3 w-px bg-border/80 md:block" />
          <span>记录思考，分享探索</span>
        </div>

        {/* 右侧组：导航链接与社交图标整合 */}
        <div className="flex items-center gap-4 text-text-subtle">
          <Link
            href="https://github.com/chenyufengedu-dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted transition-colors duration-200 hover:text-text-primary"
            aria-label="GitHub"
          >
            <FaGithub size={20} />
          </Link>
          <Link
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted transition-colors duration-200 hover:text-text-primary"
            aria-label="Twitter"
          >
            <FaTwitter size={20} />
          </Link>
          <Link
            href="mailto:your@email.com"
            className="text-text-muted transition-colors duration-200 hover:text-text-primary"
            aria-label="Email"
          >
            <Mail size={20} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
