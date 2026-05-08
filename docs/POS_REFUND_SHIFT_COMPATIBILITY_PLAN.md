# POS Refund/Return Shift Compatibility Plan (Firebase) — Docs + Minimal POS Runtime Guards

This document prepares the **current Firebase/Vite POS refund completion flow** to be safer while we transition toward compatibility with `DRAFT_pos_hardened_firestore.rules`.

> Constraint reminder (current phase):
> - Do **not** deploy Firestore rules.
> - Do **not** edit `firestore.rules` or `DRAFT_pos_hardened_firestore.rules` yet.
> - Do **not** expand non-POS modules.
> - Allowed runtime code changes are **only** small POS refund/return compatibility guards in `src/services/returnService.ts`.

## Why refund completion requires an open shift (now)
`DRAFT_pos_hardened_firestore.rules` enforces that `pos_sales` creation must reference:
- `vendorId`
- `shiftId`
- `terminalId`
- the referenced shift is **open**
- the terminal belongs to the same vendor

Today, `completeReturnRefund` creates a refund sale (`pos_sales`) and sale items/ledger entries, then updates the original sale.

If the referenced shift is closed, strict draft rules will likely block `pos_sales` creation.

Therefore, before creating the refund sale we must fail fast with a friendly message when the shift is missing/closed.

## Why terminal validation is required
Strict draft rules also validate terminal ownership:
- `pos_sales.terminalId` must exist
- `pos_terminals.vendorId` must match the refund vendor

Therefore, before creating the refund sale we validate the terminal exists and is linked to the correct vendor.

## Why the original sale update remains a blocker
Current flow still performs:
- `batch.update(pos_sales/{originalSaleId})` to set return flags.

Strict draft rules likely deny updates on `pos_sales`, so this update step is not compatible with the strict end-state.

We keep the update for now, but we document it as a TODO that must move to a backend/callable flow or an append-only “return summary” model.

## Final target (strict end-state)
The long-term solution is to move refund finalization into a guarded callable backend function:
- `finalizeRefund`

That callable should:
- validate shift open
- validate terminal belongs to vendor
- perform atomic creation of refund sale + items + ledger + stock adjustments
- create any immutable evidence (audit/BI)
- avoid forbidden updates to immutable/denied collections, or replace them with append-only summaries.

## Append-only return summary introduced
To reduce dependency on mutating `pos_sales/{originalSaleId}` (which strict draft rules will deny), `completeReturnRefund` now writes an append-only document:

- `pos_return_summaries/{summaryId}`

Written fields:
- `summaryId`
- `vendorId`
- `originalSaleId`
- `refundSaleId`
- `returnRequestId`
- `refundReceiptNumber`
- `totalRefund`
- `totalCostReversal`
- `refundMethod`
- `terminalId`
- `shiftId`
- `completedByUid`
- `completedByEmail`
- `createdAt`

This summary is the future replacement for mutating the original sale header.

Strict rules can later allow `pos_return_summaries` create while denying `pos_sales` update.

## Deployment/implementation sequence
1. Add shift pre-checks in `completeReturnRefund`.
2. Add terminal pre-checks in `completeReturnRefund`.
3. Test refund completion with:
   - open shift (should proceed)
   - closed shift (should throw the friendly error and not write refund sale)
4. Confirm the friendly errors match expectations.
5. Verify append-only `pos_return_summaries` write happens during refund finalization.
6. Later move/remove the temporary original `pos_sales` update once the UI no longer depends on it.
7. Only then revisit strict draft rules deployment.


