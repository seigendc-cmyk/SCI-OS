# Firebase POS Security Rules Emulator Test Plan (Draft)

## SOT context
- Firebase/Vite is kept for now (no backend stack change).
- This plan is **documentation only**.
- It validates **`DRAFT_pos_hardened_firestore.rules`** (NOT production `firestore.rules`).
- No rule deployment is performed as part of this plan.

## Goal
Use **Firebase Emulator Suite** to verify that `DRAFT_pos_hardened_firestore.rules` enforces:
- POS tenant/vendor boundaries
- create-only / append-only behavior for evidence collections
- strict validation of referenced documents (e.g., `pos_sales` existence)
- deny update/delete where required

## Test scope coverage
Covers required tests 1–12:
1. approval_requests create with `requestedBy`
2. approval_requests approve/reject with `approvedBy` and `decidedAt`
3. ordinary `vendor_staff` cannot approve/reject
4. pos_sales create succeeds with open shift and valid terminal
5. pos_sales create fails with closed shift
6. pos_sale_items create succeeds only when linked sale belongs to same vendor
7. pos_return_summaries create succeeds when refund sale exists
8. pos_return_summaries create fails when refund sale missing
9. pos_return_summaries update/delete denied
10. audit_logs, biEvents, inventory_ledger update/delete denied
11. cross-vendor reads/writes denied
12. original pos_sales update denied under strict draft rules

## Emulator setup prerequisites
1. Install dependencies:
   - From repo root: `npm install`
2. Ensure Firebase Emulator Suite is supported in this project (check existing firebase config).
3. Required env vars:
   - Use the emulator defaults or your local credentials.
   - Do **not** use production keys.

## How to run emulator (commands)
> These commands are the standard workflow; adjust paths/config if your repo already contains emulator scripts.

### 1) Start emulators
```bash
firebase emulators:start --only firestore
```

### 2) In a separate terminal: run tests
If you use `firebase-tools` with a test runner, run the suite you add (not included here as this is doc-only). Example patterns:
- `npm run test` (if existing)
- or `node`/`ts-node` scripts that use the Firebase Admin SDK configured for the emulator.

## Test methodology
- Use the Firestore emulator and authenticate as different users.
- For each test:
  - Seed required documents.
  - Attempt the write/read.
  - Assert pass/fail.

### Authentication model assumed by DRAFT rules
`DRAFT_pos_hardened_firestore.rules` uses:
- `request.auth.uid`
- `/app_users/{uid}` document fields:
  - `vendorId`
  - `profileStatus`
  - `role` (e.g. `vendor_staff`, `vendor_owner`, `manager`, `vendor_admin`, `owner`)

## Required seed documents
Seed these baseline documents in emulator before tests.

### Seed users (`app_users`)
Create:
1. `app_users/ownerA`
   - `vendorId: "vendorA"`
   - `profileStatus: "active"` (anything not `'suspended'`)
   - `role: "vendor_owner"`
2. `app_users/staffA`
   - `vendorId: "vendorA"`
   - `profileStatus: "active"`
   - `role: "vendor_staff"`
3. `app_users/staffB`
   - `vendorId: "vendorB"`
   - `profileStatus: "active"`
   - `role: "vendor_staff"`
4. (Optional) `app_users/adminA`
   - `role: "manager"` or `vendor_admin` to test admin path.

> Field names must match what `DRAFT_pos_hardened_firestore.rules` reads.

### Seed POS setup
Vendor A:
- `pos_terminals/termA-1`
  - `vendorId: "vendorA"`
- `pos_shifts/shiftA-open`
  - `vendorId: "vendorA"`
  - `status: "open"`
- `pos_shifts/shiftA-closed`
  - `vendorId: "vendorA"`
  - `status: "closed"`

Refund scenario:
- Create a refund sale record for Vendor A (seed using open shift constraints):
  - `pos_sales/refundSaleA-1`
    - `vendorId: "vendorA"`
    - `shiftId: "shiftA-open"`
    - `terminalId: "termA-1"`
    - any other required fields for your app; rules only check presence/types relevant to create constraints.

Cross-vendor terminal:
- `pos_terminals/termB-1`
  - `vendorId: "vendorB"`

## Expected pass/fail matrix
Legend:
- ✅ should be allowed
- ❌ should be denied

### Test 1) approval_requests create with requestedBy
- Auth: `ownerA`
- Write: `approval_requests/{approvalId}` with:
  - `vendorId: "vendorA"`
  - `requestedBy: "staffA"` (string)
  - `requestType: "POS_RETURN_REFUND"`
  - `createdAt: <timestamp>`
  - `requestedBy == request.auth.uid` must hold (rule checks equality)
- Case A:
  - requestedBy == `ownerA` ✅
- Case B:
  - requestedBy != `ownerA` (e.g. staffA) ❌

### Test 2) approval_requests approve/reject with approvedBy and decidedAt
- Auth: `ownerA` (must satisfy `isVendorAdminOrOwner`)
- Setup: existing `approval_requests/{approvalId}` in `pending`.
- Update payload must include:
  - `status: "approved"` or `"rejected"`
  - `approvedBy: request.auth.uid`
  - `decidedAt: <timestamp>`
- Existing doc status must be in `['pending','approved_pending']`
- Expected:
  - ✅ `approved` with approvedBy & decidedAt
  - ✅ `rejected` with approvedBy & decidedAt
  - ❌ if decidedAt missing/null
  - ❌ if approvedBy does not match request.auth.uid

### Test 3) ordinary vendor_staff cannot approve/reject
- Auth: `staffA`
- Attempt approve/reject update on `approval_requests/{approvalId}` owned by `vendorA`.
- Expected: ❌ update denied

### Test 4) pos_sales create succeeds with open shift and valid terminal
- Auth: `staffA` (vendor member)
- Attempt create `pos_sales/{saleId}` with:
  - `vendorId: "vendorA"`
  - `shiftId: "shiftA-open"`
  - `terminalId: "termA-1"`
- `shiftA-open` must have `status: "open"`
- `pos_terminals/termA-1.vendorId` must equal `vendorId`
- Expected: ✅ allowed

### Test 5) pos_sales create fails with closed shift
- Auth: `staffA`
- Attempt create `pos_sales/{saleId}` with:
  - `shiftId: "shiftA-closed"`
- Expected: ❌ deny (fails `isOpenShift`)

### Test 6) pos_sale_items create succeeds only when linked sale belongs to same vendor
- Setup:
  - `pos_sales/saleA-1` with `vendorId: "vendorA"`
- Auth: `staffA`
- Attempt create `pos_sale_items/{itemId}` with:
  - `vendorId: "vendorA"`
  - `saleId: "saleA-1"`
- Expected: ✅ allowed

Cross-vendor failure:
- Auth: `staffA`
- Attempt create with `saleId: "saleB-1"` (vendorB sale) but `vendorId: "vendorA"`
- Expected: ❌ denied

### Test 7) pos_return_summaries create succeeds when refund sale exists
- Setup refund sale:
  - `pos_sales/refundSaleA-1` exists with `vendorId: "vendorA"`
- Auth: `staffA` (vendor member)
- Attempt create `pos_return_summaries/{summaryId}` with fields:
  - `vendorId: "vendorA"`
  - `originalSaleId: "origSaleA-1"`
  - `refundSaleId: "refundSaleA-1"`
  - `returnRequestId: "returnReqA-1"`
  - `terminalId: "termA-1"`
  - `shiftId: "shiftA-open"`
  - `completedByUid: "staffA"` (must equal request.auth.uid)
  - `createdAt: <timestamp>`
- Expected: ✅ allowed

### Test 8) pos_return_summaries create fails when refund sale missing
- Auth: `staffA`
- Same payload as Test 7, but set:
  - `refundSaleId: "missingRefundSale"`
- Expected: ❌ denied (`exists(pos_sales/{refundSaleId})`)

### Test 9) pos_return_summaries update/delete denied
- Auth: `ownerA` or `staffA`
- Create a summary doc first.
- Attempt:
  - update `pos_return_summaries/{summaryId}`
  - delete `pos_return_summaries/{summaryId}`
- Expected: ❌ update/delete denied

### Test 10) audit_logs, biEvents, inventory_ledger update/delete denied
- Auth: `staffA`
- Attempt update and delete on existing docs in:
  - `audit_logs/{logId}`
  - `biEvents/{eventId}`
  - `inventory_ledger/{ledgerId}`
- Expected:
  - ❌ update denied
  - ❌ delete denied

### Test 11) cross-vendor reads/writes denied
- Auth: `staffA`
- Attempt:
  - read a `pos_return_summaries` doc seeded for `vendorB`
  - create a `pos_sales` doc with `vendorId: "vendorB"`
- Expected: ❌ both denied

### Test 12) original pos_sales update denied under strict draft rules
- Auth: `ownerA` or `staffA`
- Setup create:
  - `pos_sales/saleA-1` exists
- Attempt update:
  - `pos_sales/saleA-1` fields (e.g. `hasReturn`, `returnedAmount`)
- Draft rule states `allow update, delete: if false;`
- Expected: ❌ update denied

## Notes on deployment readiness
- `DRAFT_pos_hardened_firestore.rules` is **not production deployable** until all required tests pass.
- In addition, the platform must remove/migrate any workflow that relies on mutating:
  - `pos_sales` and other collections denied by strict draft rules.
- For returns/refunds, the long-term requirement is:
  - eliminate client-side updates to original `pos_sales/{originalSaleId}` (move backend-side or remove UI dependency).

## Completion criteria
- All 12 tests pass in emulator.
- Any temporary compatibility exceptions are identified and removed (or moved backend-side).

