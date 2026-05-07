# POS Rules Compatibility Audit (Draft)

Compares **current POS frontend writes** against the draft rules file:
- `DRAFT_pos_hardened_firestore.rules`

This is documentation-only: **no code changes**, **no rule deployment**, and **no edit to `firestore.rules`**.

## What the audit can/can’t guarantee
- This audit searches source for Firestore write calls that target the POS collections.
- It does not prove which runtime paths are executed in every UI flow.
- The draft rules assume certain schema fields (notably `vendorId`, `shiftId`, `terminalId`, `status`, `requestedBy`, `requestType`, `createdAt`).

## Collections audited (as requested)
- `pos_sales`
- `pos_sale_items`
- `pos_cash_movements`
- `pos_events`
- `pos_shifts`
- `pos_terminals`
- `approval_requests`
- `audit_logs`
- `biEvents`
- `inventory_ledger`
- `cogs_reserve_ledger`

---

## Write inventory (per collection)

### A) `audit_logs`
| Source file | Operation | Required fields written (observed) | Would draft allow? | Reason (allow/block) | Required change |
|---|---:|---|---|---|---|
| `src/services/orderService.ts` (`createAuditLog`) | **create** (`setDoc(doc(db,'audit_logs', logId), ...)`) | `action`, `targetType`, `targetId`, `vendorId` (or `'system'` fallback), `performedBy`, `timestamp`, `createdAt` | **BLOCK likely** | Draft requires vendor-member read scope and create uses `canCreateVendorPOS(incoming().vendorId)` = `isVendorMember(vendorId)`.
Additionally, `orderService` writes `vendorId: data.vendorId || 'system'`, so missing vendor scoping can fail membership checks. | Ensure all audit logs written with correct `vendorId` and authored by vendor member; OR (final hardened target) move `audit_logs` creation behind callable/servers so client cannot provide wrong vendor. |
| `src/services/db.ts` (`logAuditEvent`) | **create** (`addDoc(collection(db,'audit_logs'), ...)`) | Based on caller: likely `action`, `actorUid/email/role`, `targetType/id`, `vendorId` optional, plus server timestamp | **BLOCK likely** | Same membership constraint as above: draft expects `incoming().vendorId` to match authenticated vendor membership. If caller omits `vendorId`, draft denies. | Enforce client always provides `vendorId` or move creation to backend-only. |

**Breakpoint note**
- In a final hardened end-state, `audit_logs` should be **backend-only** (draft already marks this in comments, but in the draft it is still client-create allowed under strict membership).

---

### B) `biEvents`
| Source file | Operation | Required fields written (observed) | Would draft allow? | Reason (allow/block) | Required change |
|---|---:|---|---|---|---|
| `src/services/biService.ts` (`createBIEvent`) | **create** (`setDoc(doc(db,'biEvents', eventId), ...)`) | `vendorId`, `userId`, `userEmail`, `userRole`, `eventType`, `severity`, `message`, optional `branchId/terminalId/shiftId`, plus `reviewed=false`, `createdAt` | **ALLOW if `vendorId` is correct** | Draft allows `biEvents` create only if `canCreateVendorPOS(incoming().vendorId)` is true (vendor member). This function does include `vendorId` in payload. | No immediate code/rules change required *for biEvents*, as long as all call sites pass correct `vendorId` and authenticated user is vendor member. |

**Breakpoint note**
- Draft is conservative; final hardened version should move BI event creation behind callable/backend.

---

### C) `pos_events`
| Source file | Operation | Required fields written (observed) | Would draft allow? | Reason (allow/block) | Required change |
|---|---:|---|---|---|---|
| `src/services/orderService.ts` (`createPOSEvent`) | **create** (`setDoc(doc(db,'pos_events', eventId), ...)`) | includes `vendorId`, optional `branchId/terminalId/shiftId`, `eventType`, `actorUid`, `actorEmail`, `actorRole`, plus `createdAt` and `role` | **ALLOW if `vendorId` is correct** | Draft allows `pos_events` create if `isVendorMember(incoming().vendorId)`.
It does not enforce additional required keys for `pos_events` (only tenant/member condition). | None required unless a call site sometimes omits/wrong-sets vendorId.

---

### D) `approval_requests`
| Source file | Operation | Required fields written (observed) | Would draft allow? | Reason (allow/block) | Required change |
|---|---:|---|---|---|---|
| `src/services/returnService.ts` (`createReturnRequest`) | **create** (`batch.set(doc(db,'approval_requests', approvalId), approvalPayload)`) | Fields observed: `vendorId`, `requestType:'POS_RETURN_REFUND'`, `sourceCollection:'pos_return_requests'`, `sourceId:returnId`, `requestedByUid` (note naming), `requestedByEmail`, `status:'pending'`, `reason`, `amount`, `createdAt`, `updatedAt` | **PARTIALLY/LIKELY BLOCK** | Draft approval_requests **create** requires:
- `vendorId` (string)
- `requestedBy` field equals `request.auth.uid`
- `requestType` string
- `createdAt is timestamp`
But returnService writes `requestedByUid` not `requestedBy`, so `incoming().requestedBy is string` will likely fail. Also `createdAt` is `now` from `serverTimestamp()` so it’s a Firestore Timestamp—OK. | Rules change needed to align field names **or** code change to write `requestedBy` exactly.
For strict compatibility: update returnService to use `requestedBy` field name, not `requestedByUid`. |
| `src/services/returnService.ts` (`approveReturnRequest`) | **update** (`batch.update(d.ref, approvalUpdate)`) | Fields observed: `status:'approved'`, `approvedAt`, `approvedByUid`, `approvedByEmail`, `updatedAt` | **BLOCK under draft** (for at least one schema mismatch) | Draft approval update requires:
- caller is `isVendorAdminOrOwner(vendorId)` (manager/owner/admin)
- `isImmutableAfterCreate()` (vendorId/requestType/requestedBy/createdAt unchanged)
- `incoming().status in ['approved','rejected']`
- `resource.data.status in ['pending','approved_pending']`
- `incoming().approvedBy == request.auth.uid`
- `incoming().decidedAt != null`
But approveReturnRequest writes `approvedByUid` and `approvedAt` (not `approvedBy`/`decidedAt`). So update will likely fail. | Align code field names to rule expectations (`approvedBy` and `decidedAt`), or update draft rules to match current payload schema.
This is the main approval breakpoint. |
| `src/services/returnService.ts` (`rejectReturnRequest`) | **update** (`batch.update(d.ref, { status:'rejected', updatedAt: now })`) | Writes `status:'rejected'`, `updatedAt: now` (no `approvedBy/decidedAt`) | **BLOCK** | Draft requires `approvedBy` and `decidedAt` for approval decisions. Rejection should similarly set `decidedAt` and rejector identity field per draft. | Rules change needed or update code to set `approvedBy`-equivalent + `decidedAt` for both approve and reject. |

---

### E) `pos_sales`
| Source file | Operation | Required fields written (observed) | Would draft allow? | Reason (allow/block) | Required change |
|---|---:|---|---|---|---|
| `src/services/returnService.ts` (`completeReturnRefund`) | **create** (`batch.set(doc(db,'pos_sales', refundSaleId), refundPayload)`) | Refund sale payload fields observed: `saleId`, `originalSaleId`, `receiptNumber`, `vendorId`, `terminalId`, `shiftId`, `status:'completed'`, `saleType:'refund'`, `paymentMethod`, `subtotal`, `grandTotal`, `operatorEmail`, `operatorUid`, `createdAt`, `completedAt` | **BLOCK likely** | Draft pos_sales create allows only:
- vendor member
- `shiftId` is string
- `terminalId` is string
- `isOpenShift(vendorId, shiftId)` (shift document status == 'open')
But refund sale is created during return completion; the referenced shiftId might be closed. Also draft enforces `exists(pos_terminals/terminalId)` and terminal vendorId match.
It may also allow create but then update/delete is denied. | Ensure POS shift used in refund flow is still open OR relax draft rule for “refund sale” creation. In final hardened design: refund finalization should be backend-only with explicit shift state allowances. |

**Breakpoint note**
- “sale updates blocked” is already enforced by draft: `allow update, delete: if false` for `pos_sales`.
If current code uses `batch.update(pos_sales...)` for non-idempotent changes, it will be blocked by the draft.

---

### F) `pos_sale_items`
| Source file | Operation | Required fields written (observed) | Would draft allow? | Reason (allow/block) | Required change |
|---|---:|---|---|---|---|
| `src/services/returnService.ts` (`completeReturnRefund`) | **create** (`batch.set(doc(db,'pos_sale_items', refundItemId), {...})`) | Observed fields: `itemId`, `saleId`, `vendorId`, `productId`, `productName`, `quantity` (negative), `unitPrice`, `lineTotal` (negative), `costPrice`, `createdAt` | **MAY BLOCK** | Draft pos_sale_items create requires linked sale doc exists and same vendor. If the sale create was blocked, item create will be blocked too.
Also draft doesn’t validate field names besides `saleId` and vendorId equality, so field mismatch is less likely here. | Make sure sale creation is allowed first; align schema if needed.

---

### G) `inventory_ledger`
| Source file | Operation | Required fields written (observed) | Would draft allow? | Reason (allow/block) | Required change |
|---|---:|---|---|---|---|
| `src/services/returnService.ts` (`completeReturnRefund`) | **create** (`batch.set(doc(db,'inventory_ledger', ledgerId), {...})`) | `ledgerId`, `vendorId`, `productId`, `movementType`, `quantityChange`, `referenceId`, `originalSaleId`, `notes`, `createdAt` | **ALLOW if vendor member** | Draft inventory_ledger allow create only for vendor member (`canCreateVendorPOS(incoming().vendorId)`), no extra strict field requirements.
Update/delete denied. | No immediate changes for create, but final hardened end-state should move ledger posting to backend.

---

### H) `pos_shifts` and I) `pos_terminals`
No direct writes to these POS collections were found in the scanned POS-target write calls.

That said, **runtime shift open/close flows** are not fully enumerated by this quick search:
- there are many POS operations in services that may write shift state using different collection naming or in JS runtime flows outside the POS-only write scan.

**Expected draft behavior**
- Draft currently denies `update/delete` for both `pos_shifts` and `pos_terminals`.

**Breakpoint callout**
- “shift open/close updates blocked” will occur if the current code updates an existing `pos_shifts/{shiftId}` document.

---

### J) `pos_cash_movements`
No direct writes found by this audit search targeting `pos_cash_movements`.

**Expected draft behavior**
- Draft denies `update/delete`.
- Create requires open shift.

---

### K) `cogs_reserve_ledger`
No direct writes found by this audit search.

**Expected draft behavior**
- Draft denies update/delete.
- Create allowed only for vendor members.

---

## Breakpoint summary (as requested)
1) **Shift open/close updates blocked**
- Draft denies `update/delete` on `pos_shifts` and `pos_terminals`.
- If current frontend updates shift/terminal docs, it will fail.

2) **Sale updates blocked**
- Draft denies `update/delete` for `pos_sales`.
- Any code path that calls `batch.update(doc(db,'pos_sales', ...))` will be blocked.

3) **Audit/BI client creates eventually should move backend**
- Draft allows create for now (membership-scoped), but final hardened version should move `audit_logs` and `biEvents` creation to callable/backend to eliminate client-controlled event content.

4) **Terminal updates blocked**
- Draft denies `pos_terminals` update/delete.

5) **Approval status updates now require approvedBy and decidedAt**
- Draft `approval_requests` update expects:
  - `approvedBy == request.auth.uid`
  - `decidedAt != null`
  - `incoming().status in ['approved','rejected']`
  - cannot revert to pending
  - immutable fields remain unchanged
- Current `returnService` uses different field names:
  - `approvedByUid`, `approvedAt`
  - rejection update does not include decided/approver fields
- Result: strict draft will likely BLOCK approval updates until schema is aligned.

---

## Deployment readiness checklist (draft-only readiness)

### Rules safe to deploy now?
**NO** (strict compatibility issues)

### Code changes required before deploy
Yes—at minimum:
- Align `approval_requests` payload field names with draft expectations:
  - Use `requestedBy` instead of `requestedByUid`
  - Use `approvedBy` instead of `approvedByUid`
  - Use `decidedAt` instead of `approvedAt`
  - Ensure rejection sets decision fields (e.g., `decidedAt` and decision actor)
- Ensure any `pos_sales` creates during return flows satisfy `isOpenShift`.
  - If refunds happen after shift close, relax draft shift requirement or move to callable backend with explicit override logic.
- Identify and modify any code paths that perform `update` on `pos_sales`, `pos_events`, `pos_shifts`, `pos_terminals`, or append-only collections (draft denies updates).

### Callable functions required before strict deploy
**Recommended** (not mandatory for draft testing), but for production hardening:
- Move critical writes behind callable functions:
  - sale finalization / refund completion
  - approval application
  - shift open/close transitions
  - inventory ledger posting
  - audit/bi event generation

### Temporary compatibility exceptions (if needed)
- For `pos_sales` create during refunds:
  - Allow create when shift is `closed` specifically for `saleType=='refund'`, OR skip `isOpenShift` for refund-mode until callable exists.
- For `approval_requests`:
  - Temporarily relax rule field-name matching to current schema (support `approvedByUid`, `approvedAt`), then tighten later.
- For append-only collections:
  - Temporarily allow limited updates for specific immutable transition fields if current code relies on post-create updates (not recommended).

---

## Final recommendation
Do **not** deploy `DRAFT_pos_hardened_firestore.rules` in its current strict form.

It will almost certainly block approval updates and may block refund-related sale/item creation due to:
- `approval_requests` schema mismatch (`approvedBy/decidedAt/requestedBy` vs current `*Uid/*At` naming)
- strict `pos_sales` create requiring shift status `open`
- draft denying updates across several POS collections that current flows may update.

Use this audit to align schema + payloads first, then re-audit before moving closer to production hardening.

