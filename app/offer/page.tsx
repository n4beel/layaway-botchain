"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseEther, formatEther, isAddress } from "viem";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { LAYAWAY_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { useToast } from "@/components/ui/Toast";
import { formatLayawayError } from "@/lib/errors";
import { assertActiveChain, waitSuccess } from "@/lib/useChainWrite";
import {
  MAX_ITEM_BYTES,
  MAX_TERMS_BYTES,
  MIN_COUNT,
  MAX_COUNT,
  MIN_PERIOD,
  MAX_PERIOD,
  MIN_GRACE,
  MAX_GRACE,
  MAX_FORFEIT_BPS,
} from "@/lib/limits";

export default function OfferPage() {
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const { data: walletClient } = useWalletClient();
  const { toast } = useToast();

  const deployment = getDeployment(activeBotChain.id);
  const contractAddress = deployment?.address as `0x${string}` | undefined;

  // Form states
  const [buyer, setBuyer] = useState("");
  const [item, setItem] = useState("");
  const [terms, setTerms] = useState("");
  const [instalmentStr, setInstalmentStr] = useState("1.0");
  const [count, setCount] = useState(4);
  const [periodDays, setPeriodDays] = useState(7);
  const [graceDays, setGraceDays] = useState(3);
  const [forfeitPercent, setForfeitPercent] = useState(10); // 10% = 1000 bps

  const [loading, setLoading] = useState(false);

  // Derived calculations
  let instalmentWei = 0n;
  try {
    instalmentWei = parseEther(instalmentStr || "0");
  } catch {
    instalmentWei = 0n;
  }

  const totalWei = instalmentWei * BigInt(count);
  const forfeitBps = Math.round(forfeitPercent * 100);
  const forfeitEstimateWei = (totalWei * BigInt(forfeitBps)) / 10000n;

  // Schedule preview dates
  const scheduleDates = Array.from({ length: count }, (_, i) => {
    const daysOffset = i * periodDays;
    const date = new Date(Date.now() + daysOffset * 86400 * 1000);
    return { post: i + 1, date: date.toLocaleDateString() };
  });

  // Validation
  const isBuyerValid = isAddress(buyer.trim()) && (!address || buyer.toLowerCase() !== address.toLowerCase());
  const isItemValid = item.trim().length > 0 && new TextEncoder().encode(item).length <= MAX_ITEM_BYTES;
  const isTermsValid = terms.trim().length > 0 && new TextEncoder().encode(terms).length <= MAX_TERMS_BYTES;
  const isInstalmentValid = instalmentWei > 0n;
  const isCountValid = count >= MIN_COUNT && count <= MAX_COUNT;
  const isPeriodValid = periodDays * 86400 >= MIN_PERIOD && periodDays * 86400 <= MAX_PERIOD;
  const isGraceValid = graceDays * 86400 >= MIN_GRACE && graceDays * 86400 <= MAX_GRACE;
  const isForfeitValid = forfeitBps <= MAX_FORFEIT_BPS;

  const canSubmit =
    isBuyerValid &&
    isItemValid &&
    isTermsValid &&
    isInstalmentValid &&
    isCountValid &&
    isPeriodValid &&
    isGraceValid &&
    isForfeitValid &&
    Boolean(contractAddress) &&
    Boolean(walletClient);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !walletClient || !publicClient || !contractAddress) return;

    setLoading(true);
    try {
      await assertActiveChain(walletClient);
      const periodSecs = periodDays * 86400;
      const graceSecs = graceDays * 86400;

      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: LAYAWAY_ABI,
        functionName: "offer",
        args: [
          buyer.trim() as `0x${string}`,
          item.trim(),
          terms.trim(),
          instalmentWei,
          count,
          periodSecs,
          graceSecs,
          forfeitBps,
        ],
      });

      toast(
        "info",
        "Offer submitted",
        "Waiting for transaction confirmation..."
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast(
          "success",
          "Plan Offered",
          "Your layaway plan has been created and offered to the buyer."
        );
        router.push("/");
      } else {
        throw new Error("Transaction reverted");
      }
    } catch (err: unknown) {
      toast(
        "error",
        "Offer Failed",
        formatLayawayError(err)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="New Layaway Plan" description="Reserve an item and set instalment terms for a buyer.">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">
            Create Layaway Offer
          </h1>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Step 1: Seller stipulated terms
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Panel variant="elevated" stageHeader="1. Item & Counterparty">
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-heading text-[var(--text-muted)] mb-1">
                  Buyer Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={buyer}
                  onChange={(e) => setBuyer(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
                {!isBuyerValid && buyer && (
                  <p className="text-xs text-[var(--danger)] mt-1 font-mono">
                    Must be a valid non-zero address different from seller.
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label className="text-xs uppercase font-heading text-[var(--text-muted)]">
                    Item Name / Description
                  </label>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {new TextEncoder().encode(item).length}/{MAX_ITEM_BYTES} bytes
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Rare Vintage Mechanical Watch"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  maxLength={MAX_ITEM_BYTES}
                  className="w-full px-3 py-2 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label className="text-xs uppercase font-heading text-[var(--text-muted)]">
                    Terms & Hand-over Conditions
                  </label>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {new TextEncoder().encode(terms).length}/{MAX_TERMS_BYTES} bytes
                  </span>
                </div>
                <textarea
                  rows={3}
                  placeholder="e.g. Serial #8482. Item stays in sealed vault until final instalment. Shipping via tracked courier upon completion."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  maxLength={MAX_TERMS_BYTES}
                  className="w-full px-3 py-2 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
            </div>
          </Panel>

          <Panel variant="elevated" stageHeader="2. Instalment Schedule & Forfeit Terms">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-heading text-[var(--text-muted)] mb-1">
                  Instalment Amount (BOT)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  value={instalmentStr}
                  onChange={(e) => setInstalmentStr(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-heading text-[var(--text-muted)] mb-1">
                  Instalment Count ({MIN_COUNT} - {MAX_COUNT} posts)
                </label>
                <input
                  type="number"
                  min={MIN_COUNT}
                  max={MAX_COUNT}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-heading text-[var(--text-muted)] mb-1">
                  Instalment Period (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={periodDays}
                  onChange={(e) => setPeriodDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-heading text-[var(--text-muted)] mb-1">
                  Grace Period (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={graceDays}
                  onChange={(e) => setGraceDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex justify-between items-baseline mb-1">
                  <label className="text-xs uppercase font-heading text-[var(--text-muted)]">
                    Cancellation Forfeit Rate (%)
                  </label>
                  <span className="text-xs font-mono text-[var(--accent)]">
                    {forfeitPercent}% (Max 30%)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={forfeitPercent}
                  onChange={(e) => setForfeitPercent(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                  If buyer cancels or lapses, this percentage of paid money goes to seller; remainder refunded to buyer.
                </p>
              </div>
            </div>
          </Panel>

          {/* Live Preview of Track & Schedule before submission (Spec §4) */}
          <Panel variant="track" stageHeader="Offer Preview">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="bg-[var(--bg-overlay)] p-3 rounded border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block">Total Plan Price</span>
                  <span className="text-base font-bold text-[var(--accent)]">
                    {formatEther(totalWei)} BOT
                  </span>
                </div>
                <div className="bg-[var(--bg-overlay)] p-3 rounded border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block">Per Instalment</span>
                  <span className="text-base font-bold text-[var(--text-primary)]">
                    {formatEther(instalmentWei)} BOT
                  </span>
                </div>
                <div className="bg-[var(--bg-overlay)] p-3 rounded border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block">Max Forfeit (if paid full)</span>
                  <span className="text-base font-bold text-[var(--danger)]">
                    {formatEther(forfeitEstimateWei)} BOT
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs uppercase font-heading text-[var(--text-muted)] block mb-2">
                  Projected Instalment Schedule
                </span>
                <div className="flex flex-wrap gap-2">
                  {scheduleDates.map((s) => (
                    <div
                      key={s.post}
                      className="px-2.5 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono"
                    >
                      <span className="text-[var(--accent)] font-semibold">Post #{s.post}:</span>{" "}
                      <span className="text-[var(--text-secondary)]">{s.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <div className="flex items-center justify-end gap-4 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={!canSubmit}
            >
              Submit Layaway Offer
            </Button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
