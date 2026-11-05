import * as React from "react";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  stageHeader?: React.ReactNode;
  postTag?: string;
  variant?: "default" | "elevated" | "track";
}

export function Panel({
  className = "",
  stageHeader,
  postTag,
  variant = "default",
  children,
  ...props
}: PanelProps) {
  const bgClass =
    variant === "elevated"
      ? "bg-[var(--bg-elevated)] border-[var(--border-default)]"
      : variant === "track"
      ? "bg-[var(--bg-surface)] border-[var(--border-strong)]"
      : "bg-[var(--bg-surface)] border-[var(--border-subtle)]";

  return (
    <div
      className={`rounded-lg border p-5 relative overflow-hidden transition-all ${bgClass} ${className}`}
      {...props}
    >
      {(stageHeader || postTag) && (
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
          <div className="font-heading text-sm uppercase tracking-wide text-[var(--accent)] font-semibold">
            {stageHeader}
          </div>
          {postTag && (
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              {postTag}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export default Panel;
