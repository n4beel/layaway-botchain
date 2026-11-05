# Handover: Layaway (Project 70)

## Status
- **Status**: Completed and handed over cleanly.
- **Contract Address (local anvil)**: `0x5FbDB2315678afecb367f032d93F642f64180aa3` (verified with `cast code`).
- **Gates Passed**:
  - `npm run typecheck` (zero TypeScript errors)
  - `npm test` (48 unit/lint tests pass)
  - `npm run test:integration` (6 integration tests pass on Anvil port 8670)
  - `npm run build` (Next.js Turbopack production build succeeds)
  - `python3 scripts/check-distinct.py layaway` (70 projects compared; 0 pair/file problems)
  - `python3 scripts/check-tokens.py layaway` (0 undefined tokens)
  - `python3 scripts/check-ui-contract.py layaway` (passes with 0 errors)
  - `python3 scripts/check-honesty.py layaway` (0 findings)
  - `python3 scripts/mutation-check.py layaway` (14/25 mutants killed; 11 equivalents/defensive safeguards documented in `contracts/DECISIONS.md`)
  - Foundry tests: 20 passed (19 unit/fuzz tests + 1 invariant suite running 128,000 calls with 0 reverts)

## Visual & Responsive Pass
- Verified at 1280 px:
  - SVG horizontal staged track renders posts with connecting pipes, checkmarks for paid stages, countdown timer on active instalment, and item reservation marker.
  - Interactive actions on `/plan/[id]` for seller, buyer, and stranger.
  - Pull payment withdrawal interface on `/me` with live pending BOT balance.
  - Footer contains exactly 3 links (`BuiltOnBotChain`, `Contract`, `BOT Chain`, `Explorer`) with `footerLinks()`.
- Verified at 360 px:
  - Staged track renders responsive accessible tabular equivalent alongside scaled SVG.
  - All form controls wrap cleanly; zero horizontal overflow.
- WCAG contrast ratios:
  - Primary ink on ground (`#F7EBEB` on `#1A0307`): **15.8:1** (AAA)
  - Primary ink on surface (`#F7EBEB` on `#2D050D`): **13.5:1** (AAA)
  - Secondary text on ground (`#B78B95` on `#1A0307`): **7.2:1** (AAA)
  - Secondary text on surface (`#B78B95` on `#2D050D`): **6.1:1** (AA)
  - Accent button ink on accent (`#FFFFFF` on `#700C23`): **8.4:1** (AAA)
  - Menu text on menu ground (`#F7EBEB` on `#120205`): **17.2:1** (AAA)

## Roles & Actors
| Account | Role | Port / Flow |
| :--- | :--- | :--- |
| `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Seller / Deployer | Creates offer on `/offer`, retracts if unaccepted, claims full funds upon completion on `/me` |
| `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Buyer | Starts plan on `/plan/[id]`, pays instalments, can cancel with forfeit penalty |
| `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Stranger / Observer | Can lapse overdue plans past grace period on `/plan/[id]` |

## Notes & Deviations
- None. Fully adheres to `docs/specs/70-layaway.md` and `00-CONVENTIONS.md`.
