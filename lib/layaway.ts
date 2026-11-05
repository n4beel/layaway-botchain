// lib/layaway.ts - Reference implementation and helper functions for Layaway (Spec §2, §4)

export enum PlanState {
  Offered = 0,
  Active = 1,
  Completed = 2,
  Cancelled = 3,
  Lapsed = 4,
  Retracted = 5,
}

export interface Plan {
  id: bigint;
  seller: string;
  buyer: string;
  instalment: bigint;
  count: number;
  paidCount: number;
  forfeitBps: number;
  periodSecs: number;
  graceSecs: number;
  state: PlanState;
  startedAt: bigint;
  offerBy: bigint;
  termsBlock: number;
  item: string;
}
export type PlanData = Plan;

/**
 * Total BOT cost of the plan: instalment * count
 */
export function total(plan: { instalment: bigint; count: number }): bigint {
  return plan.instalment * BigInt(plan.count);
}

/**
 * Calculates due timestamp for a given instalment step (1-indexed)
 * Next due is startedAt + paidCount * periodSecs
 */
export function dueAt(
  plan: { startedAt: bigint; periodSecs: number },
  paidCount: number
): bigint {
  return plan.startedAt + BigInt(paidCount) * BigInt(plan.periodSecs);
}

/**
 * Checks whether an active plan is overdue past grace period
 */
export function isOverdue(
  plan: { state: PlanState; startedAt: bigint; paidCount: number; periodSecs: number; graceSecs: number },
  now: bigint
): boolean {
  if (plan.state !== PlanState.Active) return false;
  const nextDue = dueAt(plan, plan.paidCount);
  return now > (nextDue + BigInt(plan.graceSecs));
}

/**
 * Calculates refund and forfeit amounts upon cancellation/lapse (mirrors contract math)
 */
export function ifCancelled(plan: {
  instalment: bigint;
  paidCount: number;
  forfeitBps: number;
}): { refund: bigint; forfeit: bigint; paid: bigint } {
  const paid = plan.instalment * BigInt(plan.paidCount);
  const forfeit = (paid * BigInt(plan.forfeitBps)) / 10_000n;
  const refund = paid - forfeit;
  return { refund, forfeit, paid };
}

export interface TrackPost {
  number: number; // 1..count
  status: "paid" | "current" | "future";
  dueTimestamp: bigint;
  isOverdue: boolean;
  isPastGrace: boolean;
}

/**
 * Generates data for all posts on the staged track (Spec §3.1)
 */
export function trackPosts(
  plan: {
    state: PlanState;
    count: number;
    paidCount: number;
    startedAt: bigint;
    periodSecs: number;
    graceSecs: number;
  },
  now: bigint
): TrackPost[] {
  const posts: TrackPost[] = [];

  for (let i = 1; i <= plan.count; i++) {
    if (i <= plan.paidCount) {
      // Completed post
      posts.push({
        number: i,
        status: "paid",
        dueTimestamp: plan.startedAt + BigInt(i - 1) * BigInt(plan.periodSecs),
        isOverdue: false,
        isPastGrace: false,
      });
    } else if (i === plan.paidCount + 1 && plan.state === PlanState.Active) {
      // Next due post
      const nextDueTs = plan.startedAt + BigInt(plan.paidCount) * BigInt(plan.periodSecs);
      const isPastDue = now > nextDueTs;
      const isPastGrace = now > (nextDueTs + BigInt(plan.graceSecs));
      posts.push({
        number: i,
        status: "current",
        dueTimestamp: nextDueTs,
        isOverdue: isPastDue,
        isPastGrace,
      });
    } else {
      // Future pending post
      const futureDueTs =
        plan.startedAt > 0n
          ? plan.startedAt + BigInt(i - 1) * BigInt(plan.periodSecs)
          : 0n;
      posts.push({
        number: i,
        status: "future",
        dueTimestamp: futureDueTs,
        isOverdue: false,
        isPastGrace: false,
      });
    }
  }

  return posts;
}

/**
 * Formats address into compact 0x1234…5678
 */
export function formatAddress(addr: string | undefined): string {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
