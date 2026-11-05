"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient, useReadContract } from "wagmi";
import { formatEther } from "viem";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import StagedTrack from "@/components/track/StagedTrack";
import { LAYAWAY_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { useToast } from "@/components/ui/Toast";
import { formatLayawayError } from "@/lib/errors";
import { assertActiveChain, waitSuccess } from "@/lib/useChainWrite";
import { Plan, PlanState, total } from "@/lib/layaway";

export default function MePage() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const { data: walletClient } = useWalletClient();
  const { toast } = useToast();

  const deployment = getDeployment(activeBotChain.id);
  const contractAddress = deployment?.address as `0x${string}` | undefined;

  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Read pending balance (from forfeits, lapsed plans, or completed sales)
  const {
    data: pendingBalanceData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useReadContract({
    address: contractAddress,
    abi: LAYAWAY_ABI,
    functionName: "pending",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && address),
      refetchInterval: 4000,
    },
  });

  // Read user's plans
  const {
    data: myPlansData,
    isLoading: isPlansLoading,
  } = useReadContract({
    address: contractAddress,
    abi: LAYAWAY_ABI,
    functionName: "byParty",
    args: address ? [address, 0n, 20n] : undefined,
    query: {
      enabled: Boolean(contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && address),
      refetchInterval: 5000,
    },
  });

  const pendingWei = (pendingBalanceData as bigint) || 0n;
  const rawPlansTuple = myPlansData as readonly [readonly bigint[], readonly Plan[]] | undefined;
  const myPlans: Plan[] = rawPlansTuple && rawPlansTuple[1] ? [...rawPlansTuple[1]] : [];

  const handleWithdraw = async () => {
    if (!walletClient || !publicClient || !contractAddress) return;
    setWithdrawLoading(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: LAYAWAY_ABI,
        functionName: "withdraw",
      });
      toast("info", "Withdrawing", "Transferring pending BOT balance...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast("success", "Withdrawal Successful", "BOT balance transferred to your wallet.");
        refetchPending();
      }
    } catch (err) {
      toast("error", "Withdrawal Failed", formatLayawayError(err));
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <PageShell title="My Layaways" description="Your pending funds and layaway plan history.">
      <div className="space-y-8">
        {/* Pending Balance Panel with Pull Payment Withdraw button */}
        <Panel variant="elevated" stageHeader="Pending BOT Balance">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs uppercase font-heading text-[var(--text-muted)] block">
                Available to Withdraw
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold text-[var(--accent)]">
                  {formatEther(pendingWei)}
                </span>
                <span className="text-sm font-mono text-[var(--text-secondary)]">BOT</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Includes proceeds from completed sales, cancellation forfeits, or lapsed plan refunds.
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              disabled={pendingWei === 0n || !address}
              loading={withdrawLoading}
              onClick={handleWithdraw}
            >
              Withdraw Funds
            </Button>
          </div>
        </Panel>

        {/* History of plans */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-[var(--text-primary)]">
              Plan History
            </h2>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {myPlans.length} records
            </span>
          </div>

          {!address ? (
            <Panel className="text-center py-12">
              <p className="text-sm text-[var(--text-secondary)]">
                Connect your wallet to see your layaways and balance.
              </p>
            </Panel>
          ) : isPlansLoading ? (
            <Panel className="text-center py-12">
              <p className="text-sm text-[var(--text-secondary)]">Loading your plans...</p>
            </Panel>
          ) : myPlans.length === 0 ? (
            <Panel className="text-center py-12 space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">No layaway plans found for this account.</p>
              <Link href="/offer">
                <Button variant="primary" size="sm">
                  Create a Plan
                </Button>
              </Link>
            </Panel>
          ) : (
            <div className="space-y-4">
              {myPlans.map((plan, idx) => {
                const planId = rawPlansTuple && rawPlansTuple[0] ? rawPlansTuple[0][idx] : BigInt(idx + 1);
                const isBuyer = plan.buyer.toLowerCase() === address.toLowerCase();

                return (
                  <Panel
                    key={idx}
                    variant="default"
                    stageHeader={plan.item}
                    postTag={isBuyer ? "Buyer" : "Seller"}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                        <span className="text-[var(--text-muted)]">
                          Total: <strong className="text-[var(--text-primary)]">{formatEther(total(plan))} BOT</strong> ({plan.count} posts × {formatEther(plan.instalment)} BOT)
                        </span>
                        <span className="text-[var(--accent)] font-semibold capitalize">
                          Status: {PlanState[plan.state]} ({plan.paidCount}/{plan.count} paid)
                        </span>
                      </div>

                      <StagedTrack plan={plan} compact={true} />

                      <div className="pt-2 flex justify-end">
                        <Link href={`/plan/${planId}`}>
                          <Button variant="secondary" size="sm">
                            View Plan #{planId.toString()} →
                          </Button>
                        </Link>
                      </div>
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
