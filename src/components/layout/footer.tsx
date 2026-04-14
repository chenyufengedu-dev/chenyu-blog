import Link from "next/link";
import { Mail } from "lucide-react";
import { FaGithub, FaTwitter } from "react-icons/fa";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border py-10 md:py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 md:flex-row md:justify-between md:px-8">
        {/* 版权信息 */}
        <p className="text-sm text-text-muted">
          © {currentYear} Chenyu. All rights reserved.
        </p>

        {/* 社交链接 (后续可替换为你的真实链接) */}
        <div className="flex gap-5">
          <Link
            href="https://github.com"
            target="_blank"
            className="text-text-muted transition-colors hover:text-text-primary"
            aria-label="GitHub"
          >
            <FaGithub size={20} />
          </Link>
          <Link
            href="https://twitter.com"
            target="_blank"
            className="text-text-muted transition-colors hover:text-text-primary"
            aria-label="Twitter"
          >
            <FaTwitter size={20} />
          </Link>
          <Link
            href="mailto:your@email.com"
            className="text-text-muted transition-colors hover:text-text-primary"
            aria-label="Email"
          >
            <Mail size={20} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
