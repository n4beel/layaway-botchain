"use client";

import React from "react";
import { formatEther } from "viem";
import { Plan, PlanState, dueAt, isOverdue } from "@/lib/layaway";

export interface StagedTrackProps {
  plan: Plan;
  now?: bigint;
  compact?: boolean;
}

export function StagedTrack({ plan, now = BigInt(Math.floor(Date.now() / 1000)), compact = false }: StagedTrackProps) {
  const count = Number(plan.count);
  const paidCount = Number(plan.paidCount);
  const posts = Array.from({ length: count }, (_, i) => i + 1);

  // Table data for accessibility / screen-reader fallback
  const tableRows = posts.map((postNum) => {
    const isPaid = postNum <= paidCount;
    const isNext = postNum === paidCount + 1 && plan.state === PlanState.Active;
    let statusText = "Upcoming";
    let dateText = "—";

    if (isPaid) {
      statusText = "Completed";
      if (postNum === 1 && plan.startedAt > 0n) {
        dateText = new Date(Number(plan.startedAt) * 1000).toLocaleDateString();
      } else {
        dateText = "Paid";
      }
    } else if (isNext) {
      const dueTimestamp = dueAt(plan, postNum - 1);
      const overdue = isOverdue(plan, now);
      statusText = overdue ? "Overdue" : "Next Due";
      dateText = new Date(Number(dueTimestamp) * 1000).toLocaleDateString();
    }

    return { postNum, isPaid, isNext, statusText, dateText };
  });

  if (compact) {
    return (
      <div className="w-full">
        {/* Compact SVG track */}
        <div className="w-full py-2">
          <svg className="w-full h-8 overflow-visible" viewBox={`0 0 ${Math.max(count * 40, 200)} 32`}>
            {/* Background line */}
            <line
              x1="16"
              y1="16"
              x2={count * 38 - 10}
              y2="16"
              stroke="var(--border-subtle)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Progress line */}
            {paidCount > 0 && (
              <line
                x1="16"
                y1="16"
                x2={Math.min(count, Math.max(1, paidCount)) * 38 - 10}
                y2="16"
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
            {/* Post nodes */}
            {posts.map((postNum, idx) => {
              const cx = 16 + idx * 36;
              const isPaid = postNum <= paidCount;
              const isNext = postNum === paidCount + 1 && plan.state === PlanState.Active;

              return (
                <g key={postNum} className="transition-all">
                  <circle
                    cx={cx}
                    cy={16}
                    r={isNext ? 9 : 7}
                    fill={isPaid ? "var(--accent)" : "var(--bg-surface)"}
                    stroke={isPaid || isNext ? "var(--accent)" : "var(--border-default)"}
                    strokeWidth={isNext ? 2.5 : 2}
                  />
                  {isPaid ? (
                    <text
                      x={cx}
                      y={19}
                      textAnchor="middle"
                      fill="var(--accent-ink)"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      ✓
                    </text>
                  ) : (
                    <text
                      x={cx}
                      y={19.5}
                      textAnchor="middle"
                      fill={isNext ? "var(--accent)" : "var(--text-muted)"}
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {postNum}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Full horizontal track */}
      <div className="bg-[var(--bg-surface)] p-6 rounded-lg border border-[var(--border-subtle)] relative overflow-x-auto">
        <div className="min-w-[420px] py-4">
          <div className="flex items-center justify-between relative mb-6">
            {/* Horizontal Track Connecting Line */}
            <div className="absolute top-1/2 left-6 right-6 h-1 bg-[var(--border-subtle)] -translate-y-1/2 z-0" />
            {paidCount > 1 && (
              <div
                className="absolute top-1/2 left-6 h-1 bg-[var(--accent)] -translate-y-1/2 z-0 transition-all duration-300"
                style={{
                  width: `${((paidCount - 1) / (count - 1)) * 100}%`,
                }}
              />
            )}

            {/* Posts */}
            {posts.map((postNum) => {
              const isPaid = postNum <= paidCount;
              const isNext = postNum === paidCount + 1 && plan.state === PlanState.Active;
              const isItemReservedHere =
                (paidCount === 0 && postNum === 1) ||
                (isPaid && (postNum === paidCount || (postNum === count && plan.state === PlanState.Completed)));

              let dueTimestamp = 0n;
              if (postNum > 1 && plan.startedAt > 0n) {
                dueTimestamp = dueAt(plan, postNum - 1);
              }

              return (
                <div
                  key={postNum}
                  className="relative z-10 flex flex-col items-center group flex-1"
                >
                  {/* Item Reserved Marker tag */}
                  {isItemReservedHere && (
                    <div className="absolute -top-8 px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] font-heading text-[10px] font-bold tracking-wider uppercase shadow-md whitespace-nowrap animate-bounce">
                      {plan.state === PlanState.Completed ? "Item Released" : "Item Reserved"}
                    </div>
                  )}

                  {/* Node Circle */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold border-2 transition-all ${
                      isPaid
                        ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)] shadow-[0_0_10px_rgba(125,226,209,0.3)]"
                        : isNext
                        ? "bg-[var(--bg-elevated)] border-[var(--accent)] text-[var(--accent)] ring-4 ring-[var(--accent)]/20"
                        : "bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-muted)]"
                    }`}
                  >
                    {isPaid ? "✓" : postNum}
                  </div>

                  {/* Post Label / Meta */}
                  <div className="mt-2 text-center">
                    <span className="font-heading text-xs font-semibold block text-[var(--text-primary)]">
                      Post #{postNum}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-secondary)] block">
                      {isPaid
                        ? "Paid"
                        : isNext
                        ? isOverdue(plan, now)
                          ? "Overdue"
                          : "Next Due"
                        : "Upcoming"}
                    </span>
                    {dueTimestamp > 0n && !isPaid && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono block">
                        {new Date(Number(dueTimestamp) * 1000).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Accessible Table Equivalent for Screen Readers */}
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <details className="text-xs text-[var(--text-secondary)]">
            <summary className="cursor-pointer hover:text-[var(--text-primary)] font-heading uppercase tracking-wider">
              View Instalment Schedule Table
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs border border-[var(--border-subtle)]">
                <thead className="bg-[var(--bg-overlay)] text-[var(--text-muted)] uppercase font-mono">
                  <tr>
                    <th className="p-2 border-b border-[var(--border-subtle)]">Post</th>
                    <th className="p-2 border-b border-[var(--border-subtle)]">Amount</th>
                    <th className="p-2 border-b border-[var(--border-subtle)]">Status</th>
                    <th className="p-2 border-b border-[var(--border-subtle)]">Schedule Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                  {tableRows.map((r) => (
                    <tr key={r.postNum} className={r.isNext ? "bg-[var(--bg-elevated)]" : ""}>
                      <td className="p-2 font-semibold">Post #{r.postNum}</td>
                      <td className="p-2">{formatEther(plan.instalment)} BOT</td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            r.isPaid
                              ? "bg-[var(--success)]/20 text-[var(--success)]"
                              : r.isNext
                              ? "bg-[var(--warning)]/20 text-[var(--warning)]"
                              : "bg-[var(--bg-overlay)] text-[var(--text-muted)]"
                          }`}
                        >
                          {r.statusText}
                        </span>
                      </td>
                      <td className="p-2 text-[var(--text-muted)]">{r.dateText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
export default StagedTrack;
