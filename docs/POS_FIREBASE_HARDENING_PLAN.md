# POS Firebase Hardening Plan (Foundation Only)

## Scope
Harden the existing **Firebase/Vite** POS implementation conceptually and via **future** Firebase rule + backend work.

This phase is **documentation-only**:
- No refactoring of runtime code.
- No new modules beyond POS.
- No Firestore rules deployment.

Hardening focuses on:
- Firestore security rules
- audit/BI append-only logs
- tenant/vendor-scoped access
- shift enforcement
- stock deduction discipline
- approval workflow integrity

## Goals (what “hardened POS” must guarantee)
1. **No client-side authority over critical state transitions**
   - Sales finalization, stock deductions, cash movements, and approval effects must ultimately be enforced server-side (callables/transactions verified backend).

2. **Append-only intelligence and audit signals**
   - `audit_logs` and POS `biEvents` must be effectively immutable from clients.

3. **Tenant/vendor boundaries**
   - All reads/writes constrained to records owned by the authenticated vendor (tenant).

4. **Shift discipline**
   - Sales must be tied to an open shift; shift close must block new sales.

5. **Stock deduction discipline**
   - Stock verification and deduction must be atomic.

6. **Approval workflow integrity**
   - Only authorized roles can transition approval requests.
   - Client cannot “skip” approvals by directly writing final values.

## Target architecture (end-state)

### 1) Firestore Security Rules: default deny + strict allow lists
- Default deny for all POS collections.
- POS-specific tenant scoping helpers:
  - `isVendorMember(vendorId)`
  - `isVendorOwnerOrAdmin(vendorId)`
- Immutable field enforcement for any record that must represent a fact.
- Critical collections must have very constrained updates.

### 2) POS service layer (client becomes thin)
- The frontend POS service should become a **thin client**:
  - it should only create “draft/cart” records.
  - it should request state transitions via backend callable functions.

### 3) RPC-like backend entry points (later step)
In Firebase, implement the concept of RPCs as callable/HTTPS functions that:
- validate identity + tenant/vendor
- validate shift state
- validate terminal permissions
- validate stock availability
- perform atomic writes (sale -> sale_items -> ledger -> balances)
- append audit/BI events

Proposed RPC-like entry points:
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

## Concrete hardening plan (phased)

### Phase A — Security rules tightening (documentation + prep)

**A1. Enforce tenant-scoped records**
For every POS collection requiring vendor scoping:
- enforce `incoming().vendorId` matches the vendor bound to the authenticated principal
- enforce reads are constrained similarly

**A2. Reduce update surface for critical tables**
- deny update/delete for immutable facts where possible
- limit updates to narrow, safe field changes only (if unavoidable during transition)

**A3. Append-only audit and BI**
- `audit_logs`:
  - allow create only for authenticated vendor members (temporary)
  - deny update/delete
  - final state: deny client create and allow backend-only create
- `biEvents`:
  - same as audit_logs

**A4. Approval request integrity**
`approval_requests` hardening targets:
- allow staff creation (requests)
- allow owner/admin/manager to apply decision updates
- deny delete always
- enforce state machine:
  - `pending` -> `approved` / `rejected`
  - prevent reverting back to pending

**A5. Shift enforcement**
Sales and cash actions must enforce shift invariants:
- `shiftId` present
- referenced shift must be `status == 'open'`
- shift belongs to the correct vendor

> Note: strict “shift open” validation in rules may require rule-time document reads/lookups; if that is too expensive/complex, backend callables should own enforcement.

### Phase B — Backend callables (later step, described here)

**B1. Transaction-safe finalization**
`pos.finalizeSale` callable must:
- validate open shift + terminal assignment
- validate sufficient stock
- compute inventory ledger lines + COGS snapshot (later)
- atomically write:
  - sale header (`pos_sales`)
  - sale lines (`pos_sale_items`)
  - inventory ledger (`inventory_ledger`)
  - stock balances
  - payment records / cash movements
- append audit_logs and biEvents

**B2. Prevent stock race conditions**
- avoid client-side read-modify-write for stock
- use backend transactions (or equivalent) in callable function

**B3. Approval application server-side**
- client requests approvals
- only backend applies approvals (ensures no bypass)

### Phase C — Evidence, monitoring, and invariant violations
- Ensure every invariant violation creates an audit/BI event.
- Examples:
  - attempt to sell with a closed shift
  - finalize with insufficient stock
  - mutate immutable records
  - approval bypass attempt

## Summary of deliverables in this step
This step does **only** planning docs (no runtime changes, no rules deployment).

Docs required/covered by this step:
- `docs/POS_FIREBASE_HARDENING_PLAN.md`
- `docs/POS_FIRESTORE_COLLECTIONS.md`
- `docs/POS_SECURITY_RULES_GAPS.md`
- `docs/POS_RPC_LIKE_SERVICE_PLAN.md`

