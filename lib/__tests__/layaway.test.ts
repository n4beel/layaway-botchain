import { describe, it, expect } from "vitest";
import {
  PlanState,
  total,
  dueAt,
  isOverdue,
  ifCancelled,
  trackPosts,
  formatAddress,
} from "../layaway";

describe("lib/layaway reference helpers", () => {
  it("calculates plan total", () => {
    expect(total({ instalment: 1000000000000000000n, count: 6 })).toBe(6000000000000000000n);
  });

  it("calculates dueAt for instalments", () => {
    const startedAt = 1000n;
    const periodSecs = 86400; // 1 day
    // Next instalment after 1 paid is at 1000 + 1 * 86400 = 87400
    expect(dueAt({ startedAt, periodSecs }, 1)).toBe(87400n);
    // After 2 paid is at 1000 + 2 * 86400 = 173800
    expect(dueAt({ startedAt, periodSecs }, 2)).toBe(173800n);
  });

  it("checks overdue logic with grace period boundaries", () => {
    const plan = {
      state: PlanState.Active,
      startedAt: 1000n,
      paidCount: 1,
      periodSecs: 86400,
      graceSecs: 7200, // 2 hours
    };
    // Due at 87400; Grace ends at 87400 + 7200 = 94600
    expect(isOverdue(plan, 87400n)).toBe(false); // exactly on due
    expect(isOverdue(plan, 90000n)).toBe(false); // in grace
    expect(isOverdue(plan, 94600n)).toBe(false); // exactly on grace boundary
    expect(isOverdue(plan, 94601n)).toBe(true); // past grace
  });

  it("calculates cancellation refund and forfeit split correctly", () => {
    const plan = {
      instalment: 1000000000000000000n, // 1 BOT
      paidCount: 3, // 3 BOT paid
      forfeitBps: 1500, // 15%
    };
    const { refund, forfeit, paid } = ifCancelled(plan);
    expect(paid).toBe(3000000000000000000n);
    expect(forfeit).toBe(450000000000000000n); // 0.45 BOT
    expect(refund).toBe(2550000000000000000n); // 2.55 BOT
    expect(refund + forfeit).toBe(paid);
  });

  it("generates track posts data correctly", () => {
    const plan = {
      state: PlanState.Active,
      count: 4,
      paidCount: 2,
      startedAt: 1000n,
      periodSecs: 86400,
      graceSecs: 3600,
    };
    const now = 1000n + 2n * 86400n + 100n; // slightly past 3rd due
    const posts = trackPosts(plan, now);
    expect(posts).toHaveLength(4);
    expect(posts[0].status).toBe("paid");
    expect(posts[1].status).toBe("paid");
    expect(posts[2].status).toBe("current");
    expect(posts[2].isOverdue).toBe(true);
    expect(posts[2].isPastGrace).toBe(false); // 100s into 3600s grace
    expect(posts[3].status).toBe("future");
  });

  it("formats address correctly", () => {
    expect(formatAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
    expect(formatAddress("")).toBe("");
  });
});
