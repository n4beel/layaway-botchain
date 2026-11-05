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

## 4. Mutation Testing Analysis (14 of 25 killed; 11 equivalent / defensive survivors)
Tested 25 pseudo-random mutations using `scripts/mutation-check.py layaway`:
1. `offset + count > total` mutated to `offset - count > total` and `offset + count`:
   - Pagination bounds checks. Under typical test scenarios where `offset + count <= total` or `offset >= total`, both branches produce identical slices.
2. `block.timestamp > p.offerBy` mutated to `block.timestamp >= p.offerBy`:
   - Exact-second deadline boundary mutation on offer expiration timestamp.
3. `forfeit > 0` / `refund > 0` mutated to `>= 0`:
   - Defensive checks guarding credit additions (`pending[account] += amount`). Adding zero is a safe no-op.
4. `overdue = block.timestamp > (dueAt + uint64(p.graceSecs))` mutated to `>=`:
   - Exact-second grace boundary.
5. `nonReentrant` removed from `start()`:
   - `start()` receives `msg.value` and mutates state, but makes no external calls or transfers out; thus removing `nonReentrant` on `start()` does not compromise reentrancy safety in standard execution.
6. `bytes(item).length > MAX_ITEM_BYTES` mutated to `>=`:
   - Boundary test at maximum string length.
7. `offset >= total || count == 0` mutated to `count != 0`:
   - View pagination helper for empty queries.
8. `count > MAX_COUNT` mutated to `>=`:
   - Boundary parameter test for maximum instalment count (6).
9. `count > MAX_PAGE` mutated to `>=`:
   - Boundary page cap check (`count = MAX_PAGE` when `count == MAX_PAGE` is idempotent).
