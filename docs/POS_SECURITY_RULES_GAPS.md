# POS Security Rules Gaps (Firebase) — Docs Only

This document highlights likely gaps in the current Firebase Firestore rules strategy for POS hardening.

> Important: This is not a full audit. It is a planning list of concrete gaps that must be closed.

Current rules files:
- `firestore.rules`
- `DRAFT_firestore.rules`

## 1) Public POS writes / critical mutations from client
**Gap:** Many POS flows are currently implemented by frontend services writing directly to Firestore.

Even if some update/delete is restricted, clients may still be able to:
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

If rules allow create but still allow update, clients could alter events.

**Hardened target:**
- `audit_logs`: allow create only from backend, deny update/delete
- `biEvents`: allow create only from backend, deny update/delete
- `pos_events`: if used as an event trace, treat as append-only as well

## 3) Shift enforcement not guaranteed at rule level
**Gap:** Sales creation/finalization should require an **open shift**.

Hardened target:
- sale finalization must validate `pos_shifts/{shiftId}.status == 'open'`
- shift must belong to the correct vendor

**Notes:**
- Rule-time validation may require document reads/lookups; if too complex, move enforcement into backend callables.

## 4) Terminal access control insufficient
**Gap:** Terminal operations should be tied to:
- vendorId
- staff permissions
- current shift session

**Hardened target:**
- validate that actor is allowed to use `terminalId`
- validate that `terminalId` belongs to the same vendor
- validate `terminalId` is assigned to the active shift/branch

## 5) Approval workflow could be bypassed
**Gap:** If approval update is permitted too broadly, staff may:
- write approved pricing fields directly
- update sale totals without applying approvals
- update approval_requests in unintended ways

**Hardened target:**
- enforce approval state transitions for `approval_requests`
- deny delete always
- approval decisions must be immutable after final decision

## 6) Inventory ledger + stock balances race safety
**Gap:** Firestore rules cannot easily guarantee atomic read-modify-write invariants for stock deduction.

Two clients could oversell without backend atomicity.

**Hardened target:**
- stock deduction must be backend transactions:
  - verify stock
  - append inventory ledger entries
  - update stock balances
  - append audit/BI events

## 7) Over-permissive update rules on POS tables
**Gap:** Some collections may allow `allow update` for all vendor users.

**Hardened target:**
- reduce updates for critical tables:
  - deny update/delete for immutable facts
  - allow only narrow safe field updates if needed during transition

## 8) Missing immutable field constraints
**Gap:** Rules may not enforce “set once never changes” for critical linkage fields.

Examples:
- `createdAt`
- `vendorId`
- `saleId`
- `inventory_ledger` linkage
- audit event type

**Hardened target:**
- update constraints must enforce `incoming.field == resource.field` for immutable fields

## 9) Inconsistent collection naming / schema expectations
**Gap:** POS design references may use schemas not fully mirrored in Firestore rules.

Example mismatch:
- production schema may refer to `inventory_ledger`, `sales`, `sale_items`
- current repo uses `pos_sales`, `pos_sale_items`, and `pos_events`

**Hardened target:**
- align naming + payload schema across:
  - services layer
  - security rules
  - future callable functions

## Summary: Top gaps that must be fixed
1. Deny client writes for sale finalization, stock deductions, and cash movements.
2. Ensure audit_logs and biEvents are append-only and backend-only.
3. Enforce open shift gating for sales and cash movements.
4. Tighten approval workflow state transitions.
5. Enforce immutable field constraints and deny update/delete on ledger facts.

