"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWalletClient, useReadContract } from "wagmi";
import { formatEther, parseAbiItem } from "viem";
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
import {
  Plan,
  PlanState,
  total,
  dueAt,
  isOverdue,
  ifCancelled,
  formatAddress,
} from "@/lib/layaway";

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const planId = BigInt(resolvedParams.id);
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const { data: walletClient } = useWalletClient();
  const { toast } = useToast();

  const deployment = getDeployment(activeBotChain.id);
  const contractAddress = deployment?.address as `0x${string}` | undefined;

  const [now, setNow] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));
  const [termsText, setTermsText] = useState<string | null>(null);
  const [termsLoading, setTermsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(BigInt(Math.floor(Date.now() / 1000)));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch plan data
  const {
    data: planData,
    isLoading: isPlanLoading,
    refetch: refetchPlan,
  } = useReadContract({
    address: contractAddress,
    abi: LAYAWAY_ABI,
    functionName: "planOf",
    args: [planId],
    query: {
      enabled: Boolean(contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000"),
      refetchInterval: 4000,
    },
  });

  const plan = planData as Plan | undefined;

  // Read terms from Offered event log with fromBlock = toBlock = termsBlock (Spec §4)
  useEffect(() => {
    let active = true;
    async function fetchTerms() {
      if (!publicClient || !contractAddress || !plan || plan.termsBlock === 0) {
        if (active) setTermsLoading(false);
        return;
      }
      try {
        setTermsLoading(true);
        const logs = await publicClient.getLogs({
          address: contractAddress,
          event: parseAbiItem(
            "event Offered(uint256 indexed id, address indexed seller, address indexed buyer, string item, string terms, uint128 instalment, uint8 count, uint32 periodSecs, uint32 graceSecs, uint16 forfeitBps, uint64 offerBy)"
          ),
          args: { id: planId },
          fromBlock: BigInt(plan.termsBlock),
          toBlock: BigInt(plan.termsBlock),
        });

        if (active) {
          if (logs.length > 0 && logs[0].args.terms) {
            setTermsText(logs[0].args.terms);
          } else {
            setTermsText("Terms unavailable from log");
          }
        }
      } catch (err) {
        console.error("Failed to read terms log:", err);
        if (active) setTermsText("Terms unavailable");
      } finally {
        if (active) setTermsLoading(false);
      }
    }

    fetchTerms();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress, plan?.termsBlock, planId]);

  if (isPlanLoading || !plan) {
    return (
      <PageShell title="Layaway Plan" description="Loading plan details...">
        <Panel className="text-center py-16">
          <span className="font-mono text-sm text-[var(--text-secondary)]">
            Loading plan #{resolvedParams.id}...
          </span>
        </Panel>
      </PageShell>
    );
  }

  const isBuyer = address && plan.buyer.toLowerCase() === address.toLowerCase();
  const isSeller = address && plan.seller.toLowerCase() === address.toLowerCase();

  // Next due and overdue logic
  const nextPost = Number(plan.paidCount) + 1;
  const planIsOverdue = isOverdue(plan, now);
  const nextDueDate =
    plan.state === PlanState.Active && plan.paidCount < plan.count
      ? new Date(Number(dueAt(plan, Number(plan.paidCount))) * 1000)
      : null;

  // Held and cancel / forfeit amounts
  const heldWei = plan.instalment * BigInt(plan.paidCount);
  const { refund: refundWei, forfeit: forfeitWei } = ifCancelled(plan);

  // Actions
  const handleStart = async () => {
    if (!walletClient || !publicClient || !contractAddress) return;
    setActionLoading(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: LAYAWAY_ABI,
        functionName: "start",
        args: [planId],
        value: plan.instalment,
      });
      toast("info", "Starting plan", "Submitting first instalment...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast("success", "Plan Started", "Instalment #1 paid. Item is now reserved.");
        refetchPlan();
      }
    } catch (err) {
      toast("error", "Start Failed", formatLayawayError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePay = async () => {
    if (!walletClient || !publicClient || !contractAddress) return;
    setActionLoading(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: LAYAWAY_ABI,
        functionName: "pay",
        args: [planId],
        value: plan.instalment,
      });
      toast("info", "Submitting payment", `Paying instalment #${nextPost}...`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast(
          "success",
          "Payment Confirmed",
          nextPost === Number(plan.count) ? "Plan completed! Money released to seller." : `Instalment #${nextPost} confirmed.`
        );
        refetchPlan();
      }
    } catch (err) {
      toast("error", "Payment Failed", formatLayawayError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!walletClient || !publicClient || !contractAddress) return;
    const confirm = window.confirm(
      `Are you sure you want to cancel? You will be refunded ${formatEther(refundWei)} BOT, and ${formatEther(forfeitWei)} BOT forfeit will go to the seller.`
    );
    if (!confirm) return;

    setActionLoading(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: LAYAWAY_ABI,
        functionName: "cancel",
        args: [planId],
      });
      toast("info", "Cancelling plan", "Processing cancellation and forfeit split...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast("success", "Plan Cancelled", "Refund pushed to your wallet; forfeit credited to seller.");
        refetchPlan();
      }
    } catch (err) {
      toast("error", "Cancel Failed", formatLayawayError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleLapse = async () => {
    if (!walletClient || !publicClient || !contractAddress) return;
    setActionLoading(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: LAYAWAY_ABI,
        functionName: "lapse",
        args: [planId],
      });
      toast("info", "Lapsing plan", "Reclaiming item and collecting forfeit...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast("success", "Plan Lapsed", "Item unreserved. Forfeit credited to your pending balance.");
        refetchPlan();
      }
    } catch (err) {
      toast("error", "Lapse Failed", formatLayawayError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetract = async () => {
    if (!walletClient || !publicClient || !contractAddress) return;
    setActionLoading(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: LAYAWAY_ABI,
        functionName: "retract",
        args: [planId],
      });
      toast("info", "Retracting offer", "Cancelling offer...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast("success", "Offer Retracted", "The offer is no longer open for buyer.");
        refetchPlan();
      }
    } catch (err) {
      toast("error", "Retract Failed", formatLayawayError(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <PageShell title={`Plan #${planId}: ${plan.item}`}>
      <div className="space-y-6">
        {/* Header with Title and State */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent)]">
                Plan #{planId.toString()}
              </span>
              <span
                className={`text-xs font-heading font-semibold uppercase px-2 py-0.5 rounded ${
                  plan.state === PlanState.Completed
                    ? "bg-[var(--success)]/20 text-[var(--success)]"
                    : plan.state === PlanState.Active
                    ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                    : plan.state === PlanState.Cancelled || plan.state === PlanState.Lapsed
                    ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                    : "bg-[var(--warning)]/20 text-[var(--warning)]"
                }`}
              >
                {PlanState[plan.state]}
              </span>
            </div>
            <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)] mt-1">
              {plan.item}
            </h1>
          </div>

          <div className="text-right font-mono">
            <span className="text-xs text-[var(--text-muted)] block">Total Plan Value</span>
            <span className="text-xl font-bold text-[var(--accent)]">
              {formatEther(total(plan))} BOT
            </span>
          </div>
        </div>

        {/* Spec §3.1 Banner: What is held and what quitting costs right now */}
        {plan.state === PlanState.Active ? (
          <Panel variant="elevated" className="border-l-4 border-l-[var(--accent)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm font-mono">
              <div>
                <p className="text-[var(--text-primary)] font-semibold">
                  Held: {formatEther(heldWei)} BOT. If you cancel now you get {formatEther(refundWei)} BOT back and {formatEther(forfeitWei)} BOT goes to the seller.
                </p>
                {isSeller && (
                  <p className="text-xs text-[var(--accent)] mt-1 font-heading uppercase tracking-wider">
                    Money held: {formatEther(heldWei)} BOT — yours when the last post is filled.
                  </p>
                )}
              </div>
              {planIsOverdue && (
                <span className="text-xs text-[var(--danger)] font-bold uppercase tracking-wider">
                  Plan is currently Overdue
                </span>
              )}
            </div>
          </Panel>
        ) : plan.state === PlanState.Offered ? (
          <Panel variant="elevated" className="border-l-4 border-l-[var(--warning)]">
            <p className="text-sm font-mono text-[var(--text-primary)]">
              Offer open until {new Date(Number(plan.offerBy) * 1000).toLocaleString()}.
              {now > plan.offerBy ? " (Expired)" : " Buyer may start by paying instalment #1."}
            </p>
          </Panel>
        ) : null}

        {/* The Staged Track Component (AX archetype) */}
        <StagedTrack plan={plan} now={now} />

        {/* Action Controls Box */}
        <Panel variant="track" stageHeader="Action Controls">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-heading uppercase text-[var(--text-muted)] block">
                Your Role
              </span>
              <span className="text-sm font-bold text-[var(--text-primary)]">
                {isBuyer ? "Buyer" : isSeller ? "Seller" : "Observer / Third Party"}
              </span>
              {nextDueDate && (
                <span className="text-xs font-mono text-[var(--text-secondary)] block">
                  Next post due: {nextDueDate.toLocaleDateString()} {nextDueDate.toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Buyer actions */}
              {isBuyer && plan.state === PlanState.Offered && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleStart}
                  loading={actionLoading}
                  disabled={now > plan.offerBy}
                >
                  Start Plan ({formatEther(plan.instalment)} BOT)
                </Button>
              )}

              {isBuyer && plan.state === PlanState.Active && (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handlePay}
                    loading={actionLoading}
                  >
                    Pay Post #{nextPost} ({formatEther(plan.instalment)} BOT)
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    onClick={handleCancel}
                    loading={actionLoading}
                  >
                    Cancel Plan (Forfeit {Number(plan.forfeitBps) / 100}%)
                  </Button>
                </>
              )}

              {/* Seller actions */}
              {isSeller && plan.state === PlanState.Offered && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleRetract}
                  loading={actionLoading}
                >
                  Retract Offer
                </Button>
              )}

              {isSeller && plan.state === PlanState.Active && planIsOverdue && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleLapse}
                  loading={actionLoading}
                >
                  Lapse Plan (Reclaim Item)
                </Button>
              )}

              {!isBuyer && !isSeller && (
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  Read-only view. Only designated buyer and seller can submit actions.
                </span>
              )}
            </div>
          </div>
        </Panel>

        {/* Terms and Specification Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Panel variant="default" stageHeader="Terms & Conditions">
            <div className="space-y-3">
              {termsLoading ? (
                <span className="text-xs font-mono text-[var(--text-muted)]">Loading terms from event log...</span>
              ) : (
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {termsText}
                </p>
              )}
              <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-muted)] flex justify-between">
                <span>Recorded at block: {plan.termsBlock.toString()}</span>
                <span>Forfeit Rate: {Number(plan.forfeitBps) / 100}%</span>
              </div>
            </div>
          </Panel>

          <Panel variant="default" stageHeader="Plan Parties & Timeline">
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Seller:</span>
                <span className="text-[var(--text-primary)]">{formatAddress(plan.seller)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Buyer:</span>
                <span className="text-[var(--text-primary)]">{formatAddress(plan.buyer)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Cadence:</span>
                <span className="text-[var(--text-primary)]">
                  Every {Number(plan.periodSecs) / 86400} days ({Number(plan.periodSecs)}s)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Grace Window:</span>
                <span className="text-[var(--text-primary)]">
                  {Number(plan.graceSecs) / 86400} days ({Number(plan.graceSecs)}s)
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--text-muted)]">Offer End:</span>
                <span className="text-[var(--text-primary)]">
                  {new Date(Number(plan.offerBy) * 1000).toLocaleString()}
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
