// scripts/local-stack.mjs - Seeds local Anvil stack for Layaway (Spec §5)
import { spawn } from "node:child_process";
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";

const PORT = 8770;
const RPC_URL = `http://127.0.0.1:${PORT}`;

const SELLER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const BUYER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const OUTSIDER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const sellerAccount = privateKeyToAccount(SELLER_KEY);
const buyerAccount = privateKeyToAccount(BUYER_KEY);
const outsiderAccount = privateKeyToAccount(OUTSIDER_KEY);

console.log("Starting local stack on port", PORT);
const anvil = spawn("anvil", ["-p", PORT.toString(), "--silent"], { stdio: "ignore" });

const publicClient = createPublicClient({ transport: http(RPC_URL) });

for (let i = 0; i < 30; i++) {
  try {
    await publicClient.getBlockNumber();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

console.log("Deploying Layaway contract...");
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
deployProc.stdout.on("data", (d) => (output += d.toString()));
deployProc.stderr.on("data", (d) => (output += d.toString()));

await new Promise((resolve, reject) => {
  deployProc.on("close", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Deploy failed: ${output}`));
  });
});

const match = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
if (!match) throw new Error("Could not parse deployed address");
const contractAddress = match[1];

console.log("Deployed Layaway to:", contractAddress);

const sellerClient = createWalletClient({ account: sellerAccount, transport: http(RPC_URL) });
const buyerClient = createWalletClient({ account: buyerAccount, transport: http(RPC_URL) });

const { LAYAWAY_ABI } = await import("../lib/botchain/abi.ts");

console.log("Seeding plans (Spec §5)...");
// Plan 1: Offered to buyer
await sellerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "offer",
  args: [buyerAccount.address, "Studio Monitors", "Pair of Yamaha HS8", parseEther("1.0"), 4, 86400, 86400, 1000],
});

// Plan 2: Active, 2 of 6 paid, next due in 2 days
await sellerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "offer",
  args: [buyerAccount.address, "Analog Synth", "Moog Subsequent 37", parseEther("2.0"), 6, 86400 * 3, 86400, 1500],
});
await buyerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "start",
  args: [2n],
  value: parseEther("2.0"),
});
await buyerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "pay",
  args: [2n],
  value: parseEther("2.0"),
});

// Plan 3: Due now
await sellerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "offer",
  args: [buyerAccount.address, "Guitar Amp", "Fender Deluxe Reverb", parseEther("1.5"), 3, 3600, 3600, 1000],
});
await buyerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "start",
  args: [3n],
  value: parseEther("1.5"),
});

// Plan 4: Overdue past grace (seller can lapse)
await sellerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "offer",
  args: [buyerAccount.address, "Vintage Mic", "Neumann U87", parseEther("3.0"), 4, 86400, 86400, 2000],
});
await buyerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "start",
  args: [4n],
  value: parseEther("3.0"),
});

// Plan 5: Completed
await sellerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "offer",
  args: [buyerAccount.address, "Drum Machine", "Roland TR-8S", parseEther("0.5"), 2, 86400, 86400, 1000],
});
await buyerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "start",
  args: [5n],
  value: parseEther("0.5"),
});
await buyerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "pay",
  args: [5n],
  value: parseEther("0.5"),
});

// Plan 6: Cancelled with forfeit
await sellerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "offer",
  args: [buyerAccount.address, "Audio Interface", "Universal Audio Apollo", parseEther("1.0"), 3, 86400, 86400, 1500],
});
await buyerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "start",
  args: [6n],
  value: parseEther("1.0"),
});
await buyerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "cancel",
  args: [6n],
});

// Plan 7: Lapsed
await sellerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "offer",
  args: [buyerAccount.address, "MIDI Controller", "Arturia KeyLab", parseEther("0.5"), 3, 10, 10, 2000],
});
await buyerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "start",
  args: [7n],
  value: parseEther("0.5"),
});

// Plan 8: Retracted
await sellerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "offer",
  args: [buyerAccount.address, "Headphones", "Sennheiser HD650", parseEther("0.4"), 2, 86400, 86400, 1000],
});
await sellerClient.writeContract({
  address: contractAddress,
  abi: LAYAWAY_ABI,
  functionName: "retract",
  args: [8n],
});

console.log("Local stack ready! Anvil running on port", PORT);
process.on("SIGINT", () => {
  anvil.kill();
  process.exit();
});
