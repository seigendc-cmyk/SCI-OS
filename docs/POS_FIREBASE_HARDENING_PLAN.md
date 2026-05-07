# POS Firebase Hardening Plan (Foundation Only)

## Scope
Harden the existing **Firebase/Vite** POS implementation conceptually and via **future** Firebase rule + backend work. 
- No refactoring of runtime code in this phase.
- No new modules beyond POS.
- Focus on: Firestore security rules, audit/BI append-only logs, tenant-scoped access, shift enforcement, stock deduction discipline, and approval workflow hardening.

## Goals (what “hardened POS” must guarantee)
1. **No client-side authority** over critical state transitions.
   - Sales finalization, stock deductions, cash movements, approvals effects must ultimately be enforced server-side (callable functions / transactions / verified backend services).
2. **Append-only** intelligence and audit signals.
   - `audit_logs` and POS `biEvents` must be effectively immutable from clients.
3. **Tenant/vendor boundaries**
   - All reads/writes must be constrained to records owned by the authenticated vendor (tenant).
4. **Shift discipline**
   - Sales must be tied to an open shift; shift close must block new sales.
5. **Stock deduction discipline**
   - Stock verification and deduction must be atomic.
6. **Approval workflow integrity**
   - Only authorized roles can transition approval requests.
   - Client cannot “skip” approvals by directly writing the final values.

## Current state (observations from repository)
- There are existing Firestore rules files:
  - `firestore.rules`
  - `DRAFT_firestore.rules`
- There already exists:
  - `audit_logs` and `biEvents` collections in the code.
  - POS collections such as `pos_events`, `pos_sales`, `pos_sale_items`, `pos_cash_movements`, and approval-related collections like `approval_requests`.
- The current POS service layer (frontend TS services) already writes many records directly to Firestore.

## Hardened architecture (target)
### 1) Firestore security rules: “default deny” + strict allow lists
- Continue using **default deny**.
- Add POS-specific rule helpers:
  - vendor scoping: `isVendorOwner`, `isVendorStaff`
  - POS tenancy: `incoming().vendorId == ...`
  - immutable fields: `request.resource.data.<field> == resource.data.<field>`
- Strengthen create/update/delete semantics for:
  - append-only logs: deny update/delete
  - critical transaction tables: allow only through backend callable functions (clients denied)

### 2) POS service layer (frontend) becomes “thin”
- Frontend POS services should call backend endpoints (callables) for:
  - sale finalization
  - stock posting
  - payment posting
  - cash movement
  - approval application
- Until callables exist, rules should be conservative enough that frontend writes cannot break invariants.

### 3) Cloud Functions / callable functions (next step after rules)
- Introduce callable functions later (not in this doc’s runtime changes):
  - `pos.finalizeSale`
  - `pos.postStockAndLedger`
  - `pos.openShift`, `pos.closeShift`
  - `pos.requestApproval`, `pos.applyApproval`
- Functions must:
  - validate shift is open
  - validate terminal permissions
  - validate sufficient stock
  - perform atomic writes: sale -> sale_items -> inventory ledger -> stock balances
  - append audit/BI events for every critical operation and every block

## Concrete hardening plan (phased)
### Phase A — Security rules tightening (no runtime code changes)
**A1. Enforce tenant-scoped records**
- For every POS collection, require:
  - `incoming().vendorId == <vendorId owned by auth uid>`
  - or `resource.data.vendorId == <same>`

**A2. Enforce default deny and reduce update surface**
- For “critical” collections:
  - `pos_sales`, `pos_sale_items`, `pos_cash_movements`, inventory ledger tables
  - deny client update/delete after creation.
- Only allow updates for fields that are explicitly safe and whitelisted (if any).

**A3. Append-only audit and BI**
- Rules should implement:
  - `allow create: if ...`
  - `allow update, delete: if false` (or if strict immutable constraint is satisfied)
- Existing code already writes `audit_logs` / `biEvents` from frontend.
  - After hardening, only backend should create these events (rules deny client create).

**A4. Approval request integrity**
- `approval_requests`:
  - allow create for staff roles who request
  - allow update only for owner/admin/authorized approval roles
  - deny delete always
  - enforce that approved fields match the request payload semantics

**A5. Shift enforcement**
- For `pos_sales` create/finalize:
  - require `shiftId` present
  - require `shift` exists and is `status == open`
  - require the shift belongs to the same vendor and terminal

### Phase B — Backend callables (runtime behavior changes later)
**B1. Transaction-safe finalization**
- Implement `pos.finalizeSale` callable which:
  - validates open shift + terminal assignment
  - validates product stock availability
  - posts inventory ledger entries
  - updates stock balances
  - creates sale and sale items
  - creates payments (cash/credit/layby)
  - appends audit_logs and biEvents

**B2. Prevent stock race conditions**
- Use transaction semantics in callable function:
  - read stock balances for each product
  - verify aggregate availability
  - update balances and ledger atomically

**B3. Approval application server-side**
- Ensure approvals are applied only through `pos.applyApproval` callable:
  - verify approval exists and is pending
  - verify caller role
  - apply price/discount/void/refund changes
  - record audit/bi events

### Phase C — Monitoring and evidence**
- Create an “invariant violation” event stream:
  - attempt to sell with closed shift
  - attempt to finalize with insufficient stock
  - attempt to modify immutable records
- These should always create `audit_logs` and `biEvents`.

## Append-only design: audit_logs and biEvents
### Data contract
- Every critical action creates:
  - one `audit_logs` entry (human/evidence oriented)
  - one `biEvents` entry (machine intelligence oriented)

### Immutability
- `audit_logs`
  - client: deny create/update/delete in final hardened version
  - backend only: create
  - updates: denied
- `biEvents`
  - same as above
  - allow “review flags” only if backend-controlled and append-only event pattern is used.

## Key invariants (must be enforced)
1. **No sale finalization without shift open**
2. **No stock deduction without ledger entry**
3. **No ledger entry without sale/payment linkage**
4. **No approval bypass**
5. **No client-side updates to immutable records**

## Deliverables in this docs-only step
This repository change step will only add the following docs:
- `docs/POS_FIREBASE_HARDENING_PLAN.md`
- `docs/POS_FIRESTORE_COLLECTIONS.md`
- `docs/POS_SECURITY_RULES_GAPS.md`
- `docs/POS_RPC_LIKE_SERVICE_PLAN.md`

Runtime code changes are intentionally deferred.

