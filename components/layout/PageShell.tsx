"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function PageShell({ children, title, description }: PageShellProps) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Tracks" },
    { href: "/offer", label: "New Plan" },
    { href: "/me", label: "My Layaways" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Top Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-3 h-3 rounded-full bg-[var(--accent)] ring-2 ring-[var(--accent)]/30 group-hover:scale-110 transition-transform" />
              <span className="font-heading text-lg font-bold tracking-wider text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                LAYAWAY
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent)]">
                STAGED TRACK
              </span>
            </Link>

            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--bg-elevated)] text-[var(--accent)] border border-[var(--border-subtle)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <NetworkBadge />
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Footer - exactly 3 links */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-6 text-xs text-[var(--text-muted)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-heading font-semibold text-[var(--text-primary)]">LAYAWAY</span>
            <span>•</span>
            <span>Instalment escrow with staged track execution</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/botchain-projects/layaway-botchain"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Contract
            </a>
            <a
              href="/"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Site
            </a>
            <a
              href="https://scan.botchain.net"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
export { PageShell };
