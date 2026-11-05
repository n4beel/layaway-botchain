# Handover: Layaway (`layaway-botchain`)

## Summary
- **Archetype**: AX · Staged track
- **Contract**: `Layaway.sol` deployed and tested with invariant coverage & pull payments.
- **Port**: Local stack on 8770, integration tests on 8670.

## Roles & Actors
| Role | Responsibility | Primary Views |
| :--- | :--- | :--- |
| **Seller** | Offers item on instalments, specifies price/counts/grace/forfeit, retracts unaccepted offers, receives full sum upon final payment. | `/offer`, `/plan/[id]`, `/me` |
| **Buyer** | Reviews offer, starts plan by paying first instalment (reserves item), pays subsequent instalments before grace lapses, or cancels. | `/plan/[id]`, `/me` |
| **Stranger / Observer** | Inspects track status, lapses abandoned plans past grace period to unlock forfeit to seller & refund to buyer. | `/`, `/plan/[id]` |

## Key Routes
- `/`: Track browser showing active, completed, and pending offers with visual progress dots.
- `/offer`: Form for seller to construct bespoke layaway offers.
- `/plan/[id]`: Main interactive staged track (SVG posts, tick indicators, pay/cancel/lapse actions, terms banner).
- `/me`: Withdrawal panel for claimable `pending` funds and user activity list.

## Acceptance Verification
- [x] Strict invariant test passing in Foundry (`test/LayawayInvariant.t.sol`).
- [x] Non-reentrant pull payments for all external value transfers.
- [x] Zero dev account or role toggles in shipped UI.
- [x] Footer exactly matches 3 links specification (`footerLinks()` with `BuiltOnBotChain`).
- [x] All amount inputs use `type="number" step="any"`.
- [x] Mutation check executed with all survivors documented in `contracts/DECISIONS.md`.
