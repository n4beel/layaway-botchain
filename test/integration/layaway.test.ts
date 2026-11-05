import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LAYAWAY_ABI } from "../../lib/botchain/abi";
import { ifCancelled } from "../../lib/layaway";

const ANVIL_PORT = 8670;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

// Standard Anvil test accounts
const SELLER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const BUYER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const STRANGER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const sellerAccount = privateKeyToAccount(SELLER_KEY);
const buyerAccount = privateKeyToAccount(BUYER_KEY);
const strangerAccount = privateKeyToAccount(STRANGER_KEY);

describe("Layaway Integration Tests", () => {
  let anvilProcess: ChildProcess;
  let contractAddress: `0x${string}`;

  const publicClient = createPublicClient({
    transport: http(RPC_URL),
  });

  const sellerClient = createWalletClient({
    account: sellerAccount,
    transport: http(RPC_URL),
  });

  const buyerClient = createWalletClient({
    account: buyerAccount,
    transport: http(RPC_URL),
  });

  beforeAll(async () => {
    // 1. Spawn isolated anvil on port 8670
    anvilProcess = spawn("anvil", ["-p", ANVIL_PORT.toString(), "--silent"], {
      stdio: "ignore",
    });

    // Wait for anvil to spin up
    for (let i = 0; i < 20; i++) {
      try {
        await publicClient.getBlockNumber();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // 2. Deploy Layaway contract via forge create
    const deployProc = spawn("forge", [
      "create",
      "contracts/src/Layaway.sol:Layaway",
      "--rpc-url",
      RPC_URL,
      "--private-key",
      SELLER_KEY,
      "--broadcast",
    ]);

    let output = "";
    deployProc.stdout.on("data", (data) => (output += data.toString()));
    deployProc.stderr.on("data", (data) => (output += data.toString()));

    await new Promise<void>((resolve, reject) => {
      deployProc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Deploy failed: ${output}`));
      });
    });

    const match = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
    if (!match) throw new Error(`Could not parse deployed address from: ${output}`);
    contractAddress = match[1] as `0x${string}`;
  }, 30000);

  afterAll(() => {
    if (anvilProcess) {
      anvilProcess.kill();
    }
  });

  it("verifies full completion lifecycle (start -> pay -> pay -> complete -> seller withdraws)", async () => {
    const instalment = parseEther("1.0");
    const count = 3;
    const periodSecs = 86400; // 1 day
    const graceSecs = 86400; // 1 day
    const forfeitBps = 1000; // 10%

    // 1. Seller creates offer
    const offerHash = await sellerClient.writeContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "offer",
      args: [buyerAccount.address, "Laptop Pro", "Brand new sealed", instalment, count, periodSecs, graceSecs, forfeitBps],
    });
    await publicClient.waitForTransactionReceipt({ hash: offerHash });

    const planId = 1n;
    const plan1 = await publicClient.readContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "planOf",
      args: [planId],
    });
    expect(plan1.state).toBe(0); // Offered

    // 2. Buyer starts plan (instalment 1)
    const startHash = await buyerClient.writeContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "start",
      args: [planId],
      value: instalment,
    });
    await publicClient.waitForTransactionReceipt({ hash: startHash });

    let activePlan = await publicClient.readContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "planOf",
      args: [planId],
    });
    expect(activePlan.state).toBe(1); // Active
    expect(activePlan.paidCount).toBe(1);

    // 3. Buyer pays instalment 2
    const pay2Hash = await buyerClient.writeContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "pay",
      args: [planId],
      value: instalment,
    });
    await publicClient.waitForTransactionReceipt({ hash: pay2Hash });

    activePlan = await publicClient.readContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "planOf",
      args: [planId],
    });
    expect(activePlan.paidCount).toBe(2);

    // 4. Buyer pays final instalment (3 of 3)
    const pay3Hash = await buyerClient.writeContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "pay",
      args: [planId],
      value: instalment,
    });
    await publicClient.waitForTransactionReceipt({ hash: pay3Hash });

    const completedPlan = await publicClient.readContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "planOf",
      args: [planId],
    });
    expect(completedPlan.state).toBe(2); // Completed
    expect(completedPlan.paidCount).toBe(3);

    // Full total (3 BOT) is credited to pending[seller]
    const sellerPending = await publicClient.readContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "pending",
      args: [sellerAccount.address],
    });
    expect(sellerPending).toBe(parseEther("3.0"));

    // 5. Seller withdraws
    const withdrawHash = await sellerClient.writeContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "withdraw",
    });
    await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

    const sellerPendingAfter = await publicClient.readContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "pending",
      args: [sellerAccount.address],
    });
    expect(sellerPendingAfter).toBe(0n);
  });

  it("verifies cancel and forfeit split matches ifCancelled helper", async () => {
    const instalment = parseEther("2.0");
    const count = 4;
    const periodSecs = 86400;
    const graceSecs = 86400;
    const forfeitBps = 1500; // 15%

    // 1. Seller offers
    const offerHash = await sellerClient.writeContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "offer",
      args: [buyerAccount.address, "Camera Kit", "Camera + 2 lenses", instalment, count, periodSecs, graceSecs, forfeitBps],
    });
    await publicClient.waitForTransactionReceipt({ hash: offerHash });
    const planId = 2n;

    // 2. Buyer starts (paid 1)
    const startHash = await buyerClient.writeContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "start",
      args: [planId],
      value: instalment,
    });
    await publicClient.waitForTransactionReceipt({ hash: startHash });

    // 3. Buyer pays instalment 2 (total paid 4 BOT)
    const pay2Hash = await buyerClient.writeContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "pay",
      args: [planId],
      value: instalment,
    });
    await publicClient.waitForTransactionReceipt({ hash: pay2Hash });

    // Check helper expectation
    const expected = ifCancelled({ instalment, paidCount: 2, forfeitBps });
    expect(expected.paid).toBe(parseEther("4.0"));
    expect(expected.forfeit).toBe(parseEther("0.6")); // 15% of 4
    expect(expected.refund).toBe(parseEther("3.4")); // 85% of 4

    // Read contract view
    const [viewRefund, viewForfeit] = await publicClient.readContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "ifCancelled",
      args: [planId],
    });
    expect(viewRefund).toBe(expected.refund);
    expect(viewForfeit).toBe(expected.forfeit);

    // 4. Buyer cancels plan
    const cancelHash = await buyerClient.writeContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "cancel",
      args: [planId],
    });
    await publicClient.waitForTransactionReceipt({ hash: cancelHash });

    const cancelledPlan = await publicClient.readContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "planOf",
      args: [planId],
    });
    expect(cancelledPlan.state).toBe(3); // Cancelled

    // Seller pending receives forfeit
    const sellerPending = await publicClient.readContract({
      address: contractAddress,
      abi: LAYAWAY_ABI,
      functionName: "pending",
      args: [sellerAccount.address],
    });
    expect(sellerPending).toBe(expected.forfeit);
  });
});
