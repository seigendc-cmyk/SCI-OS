# POS Firebase Firestore Collections (Hardening Reference)

This document lists POS-related Firestore collections currently present/used in code and the expected hardening posture for each.

> Note: This is a mapping reference only. No runtime changes in this step.

## Evidence of existing collections (from code + current rules)
Collections referenced by current Firestore rules / services include:
- `audit_logs`
- `biEvents`
- `pos_events`
- `pos_sales`
- `pos_sale_items`
- `pos_cash_movements`
- `pos_terminals`
- `pos_shifts`
- `approval_requests`

POS-related inventory/ledger collections appear planned/partial in the rules (examples):
- `inventory_ledger`
- `cogs_reserve_ledger`

## Hardening posture by collection

### audit_logs (append-only, evidence)
- Client create: temporary (current implementation creates from frontend)
- Hardened target:
  - client create/update/delete => denied
  - backend-only create => allowed
- Fields to enforce:
  - `createdAt` must be serverTimestamp
  - no update/delete

### biEvents (append-only, intelligence)
- Hardened target:
  - client create/update/delete => denied
  - backend-only create => allowed
- Design pattern:
  - every BI signal emitted as a new immutable document

### pos_events (POS activity stream)
- Treat as append-only operational trace.
- Hardened target:
  - allow create only if created by backend callable
  - deny update/delete

### pos_shifts (shift state machine)
- Critical: shift open/close is gating mechanism.
- Hardened target:
  - client can request open/close via callable, but cannot directly mutate `pos_shifts`
  - deny client update/delete

### pos_terminals (terminal permissions)
- Setup data.
- Hardened target:
  - allow owner/admin manage via callable or tightly-scoped client rules
  - deny staff mutation

### pos_sales (sale header)
- Hardened target:
  - client cannot finalize by writing totals directly
  - either:
    - allow draft creation only and deny finalize updates, OR
    - deny all client writes and only backend finalization creates
- Enforce invariants in rules where feasible:
  - `shiftId` must reference an open shift
  - terminal must belong to the same vendor

### pos_sale_items (sale lines)
- Hardened target:
  - deny update/delete
  - only allow create during backend finalization

### pos_cash_movements (cash drawer ledger)
- Hardened target:
  - deny client create/update/delete
  - backend-only create

### approval_requests (approval lifecycle)
- Hardened target:
  - allow staff create (requests)
  - allow owner/admin approve/reject (update)
  - deny delete always
  - enforce:
    - state machine transitions
    - only one final decision
    - immutable after final decision

### inventory ledger tables (stock movement)
Examples referenced in design/rules:
- `inventory_ledger`
- `cogs_reserve_ledger`

Hardened target:
- append-only
- client cannot write
- backend-only stock deduction flow posts ledger

## Tenant scope: vendorId
Almost all documents must include `vendorId` (or derive it) to enforce tenant scoping.

Rules must ensure:
- reads are restricted to vendor-owned records
- writes only happen for same vendor

## Shift scope: shiftId + terminalId
Sale/payment actions must always include:
- `vendorId`
- `shiftId`
- `terminalId`

Hardened target:
- sales cannot be created/finalized without valid open shift
- shift transitions block further sales

