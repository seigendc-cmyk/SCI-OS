# POS Security Rules Gaps (Firebase) — Docs Only

This document highlights likely gaps in the current Firebase Firestore rules strategy for POS hardening.

> Important: This is not a full audit. It is a planning list of concrete gaps that must be closed.
> 
> Current rules files:
> - `firestore.rules`
> - `DRAFT_firestore.rules`

## 1) Public POS writes / critical mutations from client
**Gap:** Many POS flows are currently implemented by frontend services writing directly to Firestore. Even if some update/delete is restricted, clients may still be able to:
- create sale headers (`pos_sales`)
- create/update sale items (`pos_sale_items`)
- manipulate payments or cash movements
- update inventory ledgers

**Hardened target:**
- All critical mutations should be backend-only via callable functions.
- Firestore rules should deny client writes for:
  - sale finalization states
  - stock deductions/ledger posting
  - cash movements

## 2) No robust append-only enforcement
**Gap:** Append-only requirements for `audit_logs` and `biEvents` are not guaranteed by the current rules.
- If the rules allow create but still allow update, clients could alter events.
- If update/delete is only partially denied, immutability is not ensured.

**Hardened target:**
- `audit_logs`: allow create only from backend, deny update/delete
- `biEvents`: allow create only from backend, deny update/delete
- `pos_events`: if used as an event trace, treat as append-only as well

## 3) Shift enforcement not guaranteed at rule level
**Gap:** Sales creation/finalization should require an **open shift** and correct shift ownership.
- Current rules may only check `vendorId` scoping.
- Shift gating typically requires rule-time lookup:
  - `pos_shifts/{shiftId}.status == 'open'`
  - `pos_shifts/{shiftId}.vendorId == incoming.vendorId`
  - `pos_sales.shiftId` must match the open shift

**Hardened target:**
- rule lookups or backend enforcement:
  - deny sale creation when shift is not open
  - deny cash movement when shift is closed

## 4) Terminal access control insufficient
**Gap:** Terminal operations should be tied to:
- vendorId
- staff permissions
- current shift

**Hardened target:**
- validate that the actor is allowed to use `terminalId`
- validate that `terminalId` belongs to the same vendor
- validate that `terminalId` is assigned for the current shift session

## 5) Approval workflow could be bypassed
**Gap:** If approval approval/rejection is allowed for broad vendor roles (or via insufficient checks), a staff user might:
- write approved pricing fields directly
- update sale totals without applying approval
- update approval_requests in unintended ways

**Hardened target:**
- enforce state transitions for `approval_requests`
- deny “approved effects” in sales unless an approval exists and is final
- deny delete always

## 6) Inventory ledger + stock balances race safety
**Gap:** Firestore rules cannot easily guarantee atomic read-modify-write invariants for stock deduction.
- Without backend transactions, two clients could oversell.

**Hardened target:**
- stock deduction must be a backend transaction:
  - verify stock
  - append inventory ledger
  - update stock balances
  - append audit/BI event

## 7) Over-permissive update rules on POS tables
**Gap:** Some collections may allow `allow update` for all vendor users.
- For critical tables, “update allowed” is a broad attack surface.

**Hardened target:**
- reduce updates:
  - deny update/delete for immutable facts
  - allow only safe field updates where necessary

## 8) Missing immutable field constraints
**Gap:** Rules may not enforce “once set, never changes” constraints.
Examples:
- `createdAt`
- `vendorId`
- `saleId`
- `inventory_ledger` linkage
- `audit_events` type

**Hardened target:**
- update constraints must enforce:
  - `incoming.field == resource.field` for immutable fields

## 9) Inconsistent collection naming / schema expectations
**Gap:** POS design references may use schemas not fully mirrored in Firestore rules.
- Example: the production schema requirement mentions `inventory_ledger`, `sales`, `sale_items`.
- Current repo uses different names: `pos_sales`, `pos_sale_items`, `pos_events`.

**Hardened target:**
- align naming and required fields across:
  - services layer
  - security rules
  - future callable functions

## Summary: Top 5 must-fix gaps
1. Deny client writes for sale finalization, stock deductions, and cash movements.
2. Ensure audit_logs and biEvents are append-only and backend-only.
3. Enforce open shift gating for sales and cash movements.
4. Tighten approval workflow state transitions.
5. Enforce immutable field constraints and deny update/delete on ledger facts.

