"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatEther } from "viem";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import StagedTrack from "@/components/track/StagedTrack";
import { LAYAWAY_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { Plan, PlanState, total, formatAddress } from "@/lib/layaway";

export default function HomePage() {
  const { address } = useAccount();
  const deployment = getDeployment(activeBotChain.id);
  const contractAddress = deployment?.address as `0x${string}` | undefined;

  const [now, setNow] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(BigInt(Math.floor(Date.now() / 1000)));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch latest plans from contract
  const { data: latestPlansData, isLoading } = useReadContract({
    address: contractAddress,
    abi: LAYAWAY_ABI,
    functionName: "latest",
    args: [0n, 12n],
    query: {
      enabled: Boolean(contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000"),
      refetchInterval: 5000,
    },
  });

  const rawTuple = latestPlansData as readonly [readonly bigint[], readonly Plan[]] | undefined;
  const rawIds = rawTuple?.[0] || [];
  const rawPlans = rawTuple?.[1] || [];
  const plansWithId: Plan[] = rawPlans.map((p, idx) => ({
    id: rawIds[idx] ?? BigInt(idx + 1),
    seller: p.seller,
    buyer: p.buyer,
    instalment: p.instalment,
    count: p.count,
    paidCount: p.paidCount,
    forfeitBps: p.forfeitBps,
    periodSecs: p.periodSecs,
    graceSecs: p.graceSecs,
    state: p.state,
    startedAt: p.startedAt,
    offerBy: p.offerBy,
    termsBlock: p.termsBlock,
    item: p.item,
  }));

  // Filter plans relevant to the user if connected, or show all
  const userPlans = address
    ? plansWithId.filter(
        (p) =>
          p.seller.toLowerCase() === address.toLowerCase() ||
          p.buyer.toLowerCase() === address.toLowerCase()
      )
    : plansWithId;

  const openOffers = plansWithId.filter(
    (p) =>
      p.state === PlanState.Offered &&
      (!address || p.buyer.toLowerCase() === address.toLowerCase())
  );

  return (
    <PageShell title="Layaway" description="Pay in instalments. The seller is paid when you finish.">
      <div className="space-y-8">
        {/* Hero banner explaining what is and isn't held (Spec §3.4) */}
        <Panel variant="elevated" className="border-l-4 border-l-[var(--accent)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-heading text-lg text-[var(--text-primary)] font-bold">
                What is and isn't held
              </h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                The seller is paid only after the last instalment. Until then the money is held here.
                Quitting costs the forfeit share of what you paid. The contract can't deliver or inspect the item.
                Hand-over is the seller's promise.
              </p>
            </div>
            <Link href="/offer">
              <Button variant="primary" size="md">
                Create Offer
              </Button>
            </Link>
          </div>
        </Panel>

        {/* Open Offers section if any exist */}
        {openOffers.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base text-[var(--accent)] font-semibold uppercase tracking-wider">
                Open Offers ({openOffers.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openOffers.map((plan) => (
                <Panel key={plan.id.toString()} variant="track" stageHeader={plan.item} postTag="Offered">
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline text-xs text-[var(--text-secondary)]">
                      <span>Seller: {formatAddress(plan.seller)}</span>
                      <span>Buyer: {formatAddress(plan.buyer)}</span>
                    </div>
                    <div className="flex justify-between items-baseline font-mono text-sm">
                      <span className="text-[var(--text-primary)] font-bold">
                        {formatEther(plan.instalment)} BOT × {plan.count}
                      </span>
                      <span className="text-[var(--accent)]">
                        Total: {formatEther(total(plan))} BOT
                      </span>
                    </div>
                    {/* Compact track visual */}
                    <StagedTrack plan={plan} now={now} compact={true} />
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        Forfeit: {Number(plan.forfeitBps) / 100}%
                      </span>
                      <Link href={`/plan/${plan.id}`}>
                        <Button variant="track" size="sm">
                          View Offer →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        )}

        {/* Active & Recent Tracks section: Row of small tracks (Spec §3.1) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base text-[var(--text-primary)] font-semibold uppercase tracking-wider">
              {address ? "Your Layaway Tracks" : "Recent Tracks"}
            </h3>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {userPlans.length} track{userPlans.length === 1 ? "" : "s"}
            </span>
          </div>

          {isLoading ? (
            <Panel className="text-center py-12">
              <span className="text-sm font-mono text-[var(--text-secondary)]">
                Loading layaway tracks...
              </span>
            </Panel>
          ) : userPlans.length === 0 ? (
            <Panel className="text-center py-12 space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">No layaway plans found.</p>
              <Link href="/offer">
                <Button variant="primary" size="sm">
                  Create First Offer
                </Button>
              </Link>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userPlans.map((plan) => {
                const isBuyer = address && plan.buyer.toLowerCase() === address.toLowerCase();
                const isSeller = address && plan.seller.toLowerCase() === address.toLowerCase();
                const roleTag = isBuyer ? "Buyer" : isSeller ? "Seller" : undefined;

                return (
                  <Panel
                    key={plan.id.toString()}
                    variant="default"
                    stageHeader={plan.item}
                    postTag={roleTag}
                    className="flex flex-col justify-between hover:border-[var(--border-default)] transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-baseline text-xs text-[var(--text-secondary)] font-mono">
                        <span>Plan #{plan.id.toString()}</span>
                        <span className="capitalize">{PlanState[plan.state]}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-baseline text-xs font-mono">
                          <span className="text-[var(--text-muted)]">Progress</span>
                          <span className="text-[var(--accent)] font-bold">
                            {plan.paidCount} of {plan.count} Paid
                          </span>
                        </div>
                        {/* Compact Staged Track (Spec §3.1: Home is a row of small tracks) */}
                        <StagedTrack plan={plan} now={now} compact={true} />
                      </div>

                      <div className="flex justify-between items-baseline text-xs font-mono pt-1">
                        <span className="text-[var(--text-secondary)]">Total</span>
                        <span className="text-[var(--text-primary)] font-semibold">
                          {formatEther(total(plan))} BOT
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {plan.state === PlanState.Completed
                          ? "Finished"
                          : plan.state === PlanState.Active
                          ? `${Number(plan.count) - Number(plan.paidCount)} remaining`
                          : PlanState[plan.state]}
                      </span>
                      <Link href={`/plan/${plan.id}`}>
                        <Button variant="secondary" size="sm">
                          Track Details →
                        </Button>
                      </Link>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
