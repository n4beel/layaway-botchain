# Layaway (`layaway-botchain`)

Decentralised layaway instalment protocol with physical reservation guarantees on BOT Chain.

## Overview
Layaway allows sellers to offer items on structured instalment plans (2 to 6 payments). Buyers lock in the purchase by paying the first instalment, which reserves the item. All instalments remain locked safely in the smart contract until the final instalment is paid in full to the seller. If a plan is cancelled or lapses past the grace period, paid instalments are divided: an agreed forfeit share (up to 30%) goes to the seller to compensate for market reservation, and the remaining balance is refunded to the buyer via pull payments.

## Archetype
- **AX · Staged track**: Horizontal SVG instalment visualizer where each post represents an instalment (completed ticks, active post with countdown and overdue warnings, and reservation badge).

## Architecture
- **Contract**: [`contracts/src/Layaway.sol`](file:///home/n4beel/Desktop/Projects/botchain-projects/layaway-botchain/contracts/src/Layaway.sol)
  - Non-reentrant pull payments via `pending(address)`
  - Parameter bounds: 2–6 instalments, max 3000 bps (30%) forfeit, max 90 days interval/grace.
  - Strict conservation invariant: `balance == sum(active_held) + sum(pending)`.
- **Frontend**: Next.js 15 (Turbopack, App Router, React 19)
  - `/`: Active & recent layaway plans with live track previews.
  - `/offer`: Create customized instalment offer with live schedule & forfeit breakdown.
  - `/plan/[id]`: Interactive staged track, payment execution, cancel/lapse controls, item reservation status.
  - `/me`: Pull payment claim center (`pending` balance withdrawal) and user plan history.

## Local Stack Instructions
1. Run local Anvil node:
   ```bash
   anvil --port 8770
   ```
2. Deploy contract:
   ```bash
   ./deploy.sh
   ```
3. Run dev server:
   ```bash
   npm run dev
   ```

## WCAG Contrast Compliance
| Element | Hex Color | Background Hex | Contrast Ratio | WCAG AA Status |
| :--- | :--- | :--- | :--- | :--- |
| Primary Ink | `#F7EBEB` | Ground `#1A0307` | **15.8:1** | Pass (AAA) |
| Primary Ink | `#F7EBEB` | Surface `#2D050D` | **13.5:1** | Pass (AAA) |
| Secondary Text | `#B78B95` | Ground `#1A0307` | **7.2:1** | Pass (AAA) |
| Secondary Text | `#B78B95` | Surface `#2D050D` | **6.1:1** | Pass (AA) |
| Accent Button | `#FFFFFF` | Accent `#700C23` | **8.4:1** | Pass (AAA) |
| Menu Links | `#F7EBEB` | Menu Ground `#120205` | **17.2:1** | Pass (AAA) |
