# POS RPC-like Service Plan (Firebase) — Docs Only

This doc defines an end-state “RPC-like service layer” for Firebase POS hardening.

> Constraint: This step is documentation only (no runtime changes).

## Objective
Create a boundary so that:
- clients do not directly perform critical POS state transitions
- atomicity and invariants are enforced in a backend service layer
- every critical transition creates append-only audit/BI evidence

## What “RPC-like” means in Firebase
Implement a thin set of backend entry points that behave like RPCs:
- `pos.openShift`
- `pos.closeShift`
- `pos.requestApproval`
- `pos.applyApproval`
- `pos.createSaleDraft`
- `pos.finalizeSale`
- `pos.postInventoryAndLedger`
- `pos.postPayments`
- `pos.logAudit`
- `pos.logBI`

In Firebase these can be implemented as:
- Callable Functions (`onCall`)
- HTTPS functions
- Background triggers (for append-only evidence generation)

## Service boundary responsibilities (must be consistent across all RPCs)

### 1) Identity and tenant scoping
- Determine `vendorId` from authenticated user context (never accept vendorId blindly from client)
- Enforce roles:
  - owner/admin vs staff
- Enforce terminal/branch/shift relationships belong to the same vendor

### 2) Shift state machine enforcement
- Any sale/posting must require `shift.status == 'open'`
- Closing a shift must block further sales/cash postings

### 3) Stock + ledger atomicity
For `finalizeSale` (and any stock-affecting operation):
- verify stock availability
- compute ledger lines
- update stock balances
- append inventory ledger entries

All of the above must happen atomically in backend logic.

### 4) Approval workflow integrity
- Staff can request approvals
- Only owner/admin (or roles with explicit permission) can apply approvals
- Approved/rejected decisions become immutable
- Sale effects must reference a valid approval decision when required

### 5) Append-only audit/BI events
Every RPC-like operation appends:
- `audit_logs` (evidence)
- `biEvents` (intelligence)

Rules must enforce:
- clients cannot update/delete audit/BI
- audit/BI are effectively append-only

## Security rules strategy (how rules should support the boundary)
- Default deny: deny all reads/writes not explicitly permitted
- Critical collections should deny client mutations and allow backend-only writes

Implementation options for “backend-only create” enforcement:
1. Best: callable functions + restrict client rules so that only admin/service identity can write
2. Fallback: deny client writes by default and allow only minimal safe writes (e.g., draft/cart)

## Data model mapping to current repo naming
Current code indicates these POS-related collections exist/are used:
- `pos_events`
- `pos_sales`
- `pos_sale_items`
- `pos_cash_movements`
- `pos_shifts`
- `pos_terminals`
- `inventory_ledger` (planned/used in design)
- `audit_logs`
- `biEvents`
- `approval_requests`

Future service RPCs must align with those names to avoid schema drift.

## Sequencing (what to implement first)
1. Tighten Firestore rules to stop client-side mutations of:
   - sale finalization
   - cash movements
   - ledger posting
   - stock deduction
2. Add shift gate enforcement in backend functions.
3. Implement `finalizeSale` with atomic stock/ledger posting.
4. Implement approval application via a guarded backend flow.
5. Enforce append-only on audit/BI in rules.

## Deliverable constraints for this step
- No code changes in this step.
- Only documentation to guide future hardening work.

