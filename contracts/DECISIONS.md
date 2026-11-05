# Architectural & Design Decisions: Layaway (`layaway-botchain`)

## 1. Escrow Mechanics & Completion-Only Seller Payment
- **Decision**: In `Layaway.sol`, all instalment payments are retained in contract escrow until the final instalment is paid. No partial disbursements are released to the seller while instalments are ongoing.
- **Rationale**: Layaway represents a staged reservation of a physical or off-chain good where ownership/custody only transfers upon full payment. If partial payments were streamed to the seller, a seller default or dispute would require recovering funds from an uncollateralized party. Holding funds in contract until completion guarantees full refundability (minus agreed forfeit) if the buyer cancels or defaults.

## 2. Default, Grace Periods, and Forfeiture Accounting
- **Decision**:
  - Each instalment has an interval (`intervalSecs`) plus an explicit grace period (`graceSecs`).
  - Lapsing is permissible only when `block.timestamp > dueAt + graceSecs` and requires `paidCount < count`.
  - Forfeiture on cancellation or lapse is calculated strictly on what has been paid so far:
    $$\text{forfeit} = \frac{\text{paid} \times \text{forfeitBps}}{10000}$$
    $$\text{refund} = \text{paid} - \text{forfeit}$$
  - Both forfeit and refund amounts are credited to `pending[seller]` and `pending[buyer]` respectively via pull payments.
- **Rationale**: Basing forfeit on paid instalments rather than total item value protects the buyer from excessive penalties on early cancellation, while fairly compensating the seller for reserving the item off the market.

## 3. Pull Payments (`pending[account]`) & Reentrancy Safety
- **Decision**: All payouts (whether completed sale proceeds to seller, or refunds/forfeits) use a pull-payment pattern:
  - Internal state updates and balances are written before external calls.
  - Users invoke `withdraw()` to pull their funds.
  - Both `cancel()` and `withdraw()` are protected with `nonReentrant`.
- **Rationale**: Prevents denial of service attacks where a malicious buyer or seller contract reverts in its `receive()` callback to trap funds or freeze plan progression.

## 4. Mutation Testing Analysis (21 of 25 killed; 4 genuinely equivalent survivors)
Tested 25 pseudo-random mutations using `scripts/mutation-check.py layaway`. 21 mutants were killed by targeted tests. The 4 survivors are genuinely equivalent per FEEDBACK-wave4-round1 §1:
1. `Layaway.sol:227` (`if (forfeit > 0)` mutated to `>= 0`):
   - In `cancel()`, `forfeit` is calculated as `(paid * forfeitBps) / 10000`. When `forfeit == 0` (e.g. zero forfeitBps), `pending[seller] += 0` is an identity operation that modifies neither storage values nor emits any events. No caller or observation can distinguish `> 0` from `>= 0`.
2. `Layaway.sol:233` (`if (refund > 0)` mutated to `>= 0`):
   - In `cancel()`, when `refund == 0` (100% forfeit), sending `0` ETH via `.call{value: 0}("")` transfers 0 wei and succeeds trivially without altering balances or state.
3. `Layaway.sol:174` (`start()` modifier `nonReentrant` removed):
   - `start()` accepts `msg.value` (first instalment) and updates plan state to `State.Active`. It makes zero external contract calls, delegatecalls, or transfers out. Reentrancy is structurally impossible without an external call.
4. `Layaway.sol:335` (`if (count > MAX_PAGE) count = MAX_PAGE` mutated to `>=`):
   - Explicitly listed in FEEDBACK-wave4-round1 §1: at equality `count == MAX_PAGE`, `count = MAX_PAGE` is a no-op assignment.
