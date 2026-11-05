// lib/errors.ts - Formats contract and execution errors for Layaway (Spec §4)

export function formatLayawayError(error: unknown): string {
  if (!error) return "Unknown error occurred.";

  const str = String(error);

  if (str.includes("BadBuyer")) {
    return "Buyer address must be valid and cannot be the seller.";
  }
  if (str.includes("BadText")) {
    return "Item name or terms text exceeds allowed length (Item ≤ 64 chars, Terms ≤ 300 chars).";
  }
  if (str.includes("BadParams")) {
    return "Invalid plan parameters. Verify instalment (0.01..10,000 BOT), count (2..24), period (1..90 days), grace (1..14 days), and forfeit (≤ 30%).";
  }
  if (str.includes("NoSuchPlan")) {
    return "The requested layaway plan does not exist.";
  }
  if (str.includes("NotBuyer")) {
    return "Action restricted to the plan's buyer.";
  }
  if (str.includes("NotSeller")) {
    return "Action restricted to the plan's seller.";
  }
  if (str.includes("NotOffered")) {
    return "This plan is no longer in offered state.";
  }
  if (str.includes("NotActive")) {
    return "This plan is not active.";
  }
  if (str.includes("OfferExpired")) {
    return "This offer has expired.";
  }
  if (str.includes("WrongPayment")) {
    return "Payment amount does not match the exact instalment amount.";
  }
  if (str.includes("AlreadyPaid")) {
    return "All instalments for this plan have already been paid.";
  }
  if (str.includes("NotOverdue")) {
    return "The plan is not overdue past the grace period.";
  }
  if (str.includes("NothingToWithdraw")) {
    return "You have no pending balance to withdraw.";
  }
  if (str.includes("TransferFailed")) {
    return "BOT transfer failed.";
  }
  if (str.includes("User rejected") || str.includes("User denied")) {
    return "Transaction was cancelled in wallet.";
  }

  return "Transaction failed. Please check the plan details and try again.";
}
