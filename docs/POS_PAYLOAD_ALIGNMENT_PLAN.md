# POS Payload Alignment Plan (Firebase/Vite) — Compatibility with `DRAFT_pos_hardened_firestore.rules`

## Implemented in code
- Updated `src/services/returnService.ts` approval/return flow to **dual-write** `approval_requests` payload fields so it becomes compatible with the draft rule expectations.
- Pending follow-up: refund completion will add shift/terminal open checks in `completeReturnRefund` before creating refund sale (to satisfy draft `pos_sales` create constraints).

### Implemented after approval alignment
- Refund completion compatibility work will be applied by guarding `completeReturnRefund` so it verifies:
  - shift is present and `status == 'open'`
  - terminal is present and belongs to the same vendor

### Still not deployable yet (strict draft)
- Strict draft remains blocked by the current client-side `batch.update(pos_sales/{originalSaleId})` behavior in `completeReturnRefund`. That update must move to callable/backend or be replaced with an append-only return summary.

- **Create (pending):** added `requestedBy` (while retaining `requestedByUid`) alongside `requestedByEmail`, `requestType`, `vendorId`, `createdAt`, and `status: 'pending'`.
- **Approve:** added `approvedBy` + `decidedAt` (while retaining `approvedByUid`, `approvedAt`) and kept status transitions to `status: 'approved'`.
- **Reject:** added `approvedBy` + `decidedAt` (while retaining rejection actor/time fields) and kept status to `status: 'rejected'`.


This is documentation-only. No runtime code changes, no Firestore rules deployment, and no edits to `firestore.rules`.

Goal: prepare the current Firebase POS codebase (current collection schemas/payloads) so it can become compatible with the draft hardening rules in:
- `DRAFT_pos_hardened_firestore.rules`

When the rules become deployable, the primary risk is **payload field-name mismatch** (especially approval decision fields) and **shift/sale state transition constraints** (draft denies update/delete for several POS collections).

---

## 0) Current hardening draft contract (what the draft expects)
From `DRAFT_pos_hardened_firestore.rules` the key payload expectations are:

### 0.1 `approval_requests` decisions (update rule)
Draft update rule expects (for `allow update` on `approval_requests/{approvalId}`):
- Caller must be `isVendorAdminOrOwner(resource.data.vendorId)`.
- Immutable fields must remain unchanged via `isImmutableAfterCreate()`.
- `incoming().vendorId == resource.data.vendorId`
- `incoming().status in ['approved','rejected']`
- Prevent reverting to pending:
  - `resource.data.status in ['pending','approved_pending']`
- Decision identity:
  - `incoming().approvedBy == request.auth.uid`
- Decision timestamp:
  - `incoming().decidedAt != null`
- Delete always denied.

### 0.2 `pos_sales` lifecycle
Draft denies `update/delete` on `pos_sales`.
- Only `create` is allowed under strict conditions:
  - vendor member
  - `incoming().shiftId` exists/open via `isOpenShift(vendorId, shiftId)`
  - `incoming().terminalId` exists and belongs to the same vendor

### 0.3 `pos_shifts` open/close
Draft denies `update/delete` on `pos_shifts`.
- Only `create` is allowed (and reads are vendor-scoped).

### 0.4 append-only evidence/intel collections
Draft allows **client create** for now, but in the final end-state these should become **backend/callable-only**.
- `audit_logs`: draft allows `create` for vendor members, denies update/delete.
- `biEvents`: draft allows `create` for vendor members, denies update/delete.

---

## 1) Approval Requests payload alignment

### 1.1 Current mismatch (from code inspection + required audit output)
Current code uses these field names:
- `requestedByUid` (not `requestedBy`)
- `approvedByUid` (not `approvedBy`)
- decision timestamp via `approvedAt` (not `decidedAt`)

Draft expects:
- `requestedBy`
- `approvedBy`
- `decidedAt`

### 1.2 Safe transition strategy (no breaking changes)
During the transition, use the **dual-field compatibility approach**:

#### Option A (recommended): add new draft-compatible fields while keeping old fields temporarily
When creating an `approval_requests` document and when updating its decision:
1. On **create**:
   - Keep writing `requestedByUid` as today (for existing UI reads / other code paths).
   - Also write `requestedBy` with the same value.
   - Keep `status: 'pending'` as today.
2. On **approve/reject update**:
   - Keep writing `approvedByUid` and `approvedAt` as today.
   - Also write:
     - `approvedBy` = `approvedByUid`
     - `decidedAt` = `approvedAt`

Benefits:
- Existing client logic that reads old names continues working.
- Draft rules’ update constraints are satisfied once the new fields exist.

#### Option B: update draft rules to support both names during transition
Instead of code changes, update `DRAFT_pos_hardened_firestore.rules` so the update rule accepts either:
- `approvedBy` or `approvedByUid`
- `decidedAt` or `approvedAt`
- `requestedBy` or `requestedByUid`

Drawback:
- It weakens the deterministic contract of the “strict deploy” target.

### 1.3 Decision-state field machine compatibility
Draft also constrains status transitions:
- Only allow update if current stored `resource.data.status` is in `['pending','approved_pending']`.
- Only allow `incoming().status in ['approved','rejected']`.

Plan:
- Ensure client approval updates do not attempt intermediate transitions that set status back to pending.
- Ensure both approve and reject paths include the required decision identity+timestamp fields (new draft-compatible names).

### 1.4 Temporary acceptance checklist for approvals
Before deploying softened draft rules:
- [ ] Approve path writes: `status: 'approved'`, `approvedBy`, `decidedAt`
- [ ] Reject path writes: `status: 'rejected'`, `approvedBy`, `decidedAt`
- [ ] `requestedBy` exists on create
- [ ] Immutable fields used in `isImmutableAfterCreate()` are stable (vendorId/requestType/requestedBy/createdAt)

> Note: the draft update rule assumes `incoming().get('status','')` changes to approved/rejected and checks `incoming().approvedBy` and `incoming().decidedAt`. Both must be present and non-null.

---

## 2) Return/Refund flow alignment (shift open requirement)

### 2.1 Current risk
The hardening draft requires `pos_sales` creation to reference an **open** shift:
- `isOpenShift(vendorId, shiftId)` checks `pos_shifts/{shiftId}.status == 'open'`.

Current return/refund logic may:
- create a `pos_sales` record with `saleType: 'refund'` (or similar), potentially using a shiftId that may be closed by the time refund is completed.

### 2.2 Required policy decision (before strict deploy)
Decide which operational model is acceptable:

#### Model 1 (strict): refunds must always be executed during an open shift
- Refund completion must happen only while a shift is open.
- If refund is requested while shift is closed, the UI must prompt the operator to open a shift (or route through manager flow).

How it maps to rules:
- Draft `pos_sales` create rule remains unchanged.
- Refund sale `create` succeeds only when referenced shift is open.

#### Model 2 (compatibility): manager/admin refunds can use a special callable path later
- Keep current flows temporarily.
- When strict deploy is imminent, route refund finalization through callable backend logic that:
  - validates shift state OR
  - posts the refund sale without requiring an open shift (by writing via server-approved override fields / different collections / or relaxing rule under a strict callable token).

How it maps to rules:
- During Phase 3/4 (see deployment sequence), callables create the refund sale with correct shift references.

### 2.3 Temporary compatibility approach (without code changes in this step)
Document the intended transition:
- Phase 1/2 (compatibility period): allow refunds only when shift is open (UI/UX guidance).
- Phase 3 (callable introduction): implement `finalizeRefund` callable and keep draft strict.
- Phase 5/6 (lock rules): deny any client-side refund sale creation that references closed shift.

### 2.4 Planning breakpoint to highlight
- Refund sale creation **may fail** under strict draft if it uses closed shiftId.
- The compatibility path is either:
  - enforce open shift in UI, or
  - change persistence path (callable/backend).

---

## 3) Shift open/close compatibility (draft denies `pos_shifts` update/delete)

### 3.1 Current risk
Draft denies `update/delete` for:
- `pos_shifts`
- `pos_terminals` (update/delete)

If current app logic updates an existing shift document (e.g., changing `status` from `open` to `closed`), it will be blocked.

### 3.2 Identify current shift open/close write pattern
Before strict deploy, document observed behavior:
- Does the UI create `pos_shifts/{shiftId}` once and then `update` status?
- Or does it create a new shift document per state transition?

### 3.3 Proposed transition strategy

#### Option A (preferred): switch to immutable shift creation + controlled transitions
- Create shift with `status: 'open'`.
- When closing shift, either:
  - write a separate shift-close event in `pos_events` / audit log, **without updating** the shift doc, OR
  - create a new shift doc / or use a new “shift lifecycle” pattern.

This matches draft constraints immediately.

#### Option B: softened deploy rules for shift transitions (temporarily)
If current runtime relies on `update(pos_shifts...)`:
- Temporarily allow a **very narrow** update of `status` and decision fields.
- Keep vendorId/identity immutable.

This is not implemented in this step; it is a documented fallback.

### 3.4 Temporary safe transition rule idea (document-only)
If rules must be softened later, only allow updates when:
- update is confined to `status`, `closedAt`, `closedByUid/Email` equivalents
- immutable identity fields remain unchanged
- and caller is admin/owner

---

## 4) Sale lifecycle compatibility (draft denies `pos_sales` update/delete)

### 4.1 Current risk
Draft denies update/delete for `pos_sales`.

The current app may:
- create a sale doc first, then later update it when completed
- or update totals during finalization

### 4.2 Plan options

#### Option A: ensure sale finalization happens as a single atomic create
- During strict deploy readiness, modify the app so “completed sale” is a single `setDoc(pos_sales, ...)` at the time it is finalized.
- Draft already permits `pos_sales` create.

#### Option B: callable backend finalization
- Keep client using draft-compatible create payload shape.
- When finalization is needed, call a callable backend that:
  - validates shift open state
  - posts `pos_sales` and `sale_items` as immutable records
  - posts ledger entries

This is the long-term target.

### 4.3 Temporary compatibility exceptions
For transition, do either:
- enforce that the client writes `pos_sales` only once with final status, or
- soften `pos_sales` update temporarily for a minimal “finalize” transition.

Draft currently does not allow it, so strict deploy readiness likely requires moving the lifecycle to create-only or callables.

---

## 5) `audit_logs` and `biEvents` compatibility

### 5.1 Current draft behavior
Draft allows client create for now, under membership constraints.

But it also requires that payload includes `vendorId` such that:
- read scope and create scope can be validated.

### 5.2 Plan for a deterministic log/event contract
Document and enforce (once code changes begin):
- every write includes `vendorId`
- ensure `vendorId` is never omitted and never hardcoded to `system` for vendor-scoped flows

### 5.3 Transition path to backend-only
Phase plan (see Section 6):
- Phase 1/2: write additional compatibility fields without changing behavior.
- Phase 3: deploy softened draft rules to staging.
- Phase 4: introduce callables.
- Phase 5: lock rules further to deny client creates and allow backend-only creates.

---

## 6) Deployment sequence (safe rollout)

### Phase 1 — Code payload dual-field alignment (no rules changes)
- Implement dual writes for approval decision fields:
  - `requestedByUid` + `requestedBy`
  - `approvedByUid` + `approvedBy`
  - `approvedAt` + `decidedAt`
- Ensure refund/return creation uses correct shift state assumptions (even if UI prompts).
- Ensure every log/event write includes `vendorId`.

### Phase 2 — Local verification
- Add/execute local tests or manual checks for:
  - approval update paths
  - refund completion paths
  - any shift open/close transitions
  - any sale lifecycle updates

### Phase 3 — Deploy softened draft rules to preview/staging only
- Use `DRAFT_pos_hardened_firestore.rules` (or a slightly softened variant) for preview.
- Confirm no critical POS workflows are blocked.

### Phase 4 — Add callable functions (backend/callable authority)
Introduce callables for:
- sale finalization / refund completion
- approval decision application
- shift open/close lifecycle enforcement
- inventory ledger posting (append-only)
- audit_logs and biEvents creation

### Phase 5 — Lock rules further
- Deny client create on evidence collections:
  - `audit_logs`, `biEvents`
  - optionally `inventory_ledger` and other append-only collections
- Allow only backend/callable identity principals.

### Phase 6 — Deploy hardened rules to production
- Remove remaining compatibility exceptions.
- Confirm all POS workflows are create-only for the immutable collections.

> Note: this doc is planning-only; the actual rule changes and code modifications will occur in later steps.

---

## 7) Acceptance checklist (when `DRAFT_pos_hardened_firestore.rules` becomes deployable)

### 7.1 Approval readiness
- [ ] `approval_requests` create payload includes `requestedBy` (and `requestedByUid` can remain temporarily)
- [ ] approve/reject updates include `approvedBy` and `decidedAt`
- [ ] client never attempts disallowed status transitions (no revert to pending)
- [ ] approval update identity is consistent with `request.auth.uid`

### 7.2 Sale/shift readiness
- [ ] client writes to `pos_sales` only via create when shift is open (or the operation is callable)
- [ ] client does not update `pos_sales` or `pos_shifts` once created, under strict rules
- [ ] refund sale creation path obeys shift open policy (or routes to callable)

### 7.3 Audit/BI readiness
- [ ] every audit/bi create includes correct `vendorId`
- [ ] later phases can move evidence/event creation to callable backend

### 7.4 Hard deny checks
- [ ] no POS flow relies on updates/deletes to:
  - `pos_sales`
  - `pos_sale_items`
  - `pos_terminals`
  - `pos_shifts`
  - `inventory_ledger` (if draft is append-only)
  - `audit_logs`/`biEvents`

---

## Final recommendation
Proceed with **dual-field approval alignment** and **explicit operational policy for shift-state during refunds** before any strict “deployable” attempt.

Once approvals, sale lifecycle (create-only), and shift lifecycle (no update/delete) are compatible, introduce callables and then lock rules to backend-only evidence/event posting.

