# iTred Security Specification

## 1. Data Invariants
- A `vendorUser` must have a valid `vendorId` that matches a document in the `vendors` collection.
- `app_users` profiles are private to the owner and Admins.
- `vendors` data is only public if `status == 'published'` and `visibility == 'public'`.
- `products` are only public if `status == 'published'`, `visibility == 'public'`, and `stockQty > 0`.
- Audit logs are append-only for authenticated users.

## 2. The "Dirty Dozen" Payloads (Denial Tests)

1. **Identity Spoofing**: Attempt to create `app_users` with a different UID.
2. **Role Escalation**: Attempt to set `role: 'super_admin'` during self-registration.
3. **Ghost Update**: Update `vendors` status from `draft` to `published` without being the owner.
4. **Data Poisoning**: Inject 1MB string into a product name.
5. **Relational Breach**: Create a `branch` for a `vendorId` I don't own.
6. **Immutable Violation**: Change `createdAt` on an existing document.
7. **Bypass Verification**: Set `verified: true` on my own vendor profile.
8. **PII Leak**: List all `app_users` as a public user.
9. **Query Scrape**: Attempt to fetch items from `products` without a `where` clause on the client SDK.
10. **State Shortcut**: Move an `order` from `pending` to `delivered` without the `vendor_staff` role.
11. **Orphaned Write**: Create a `product` referencing a non-existent `vendorId`.
12. **Audit Deletion**: Attempt to delete an `audit_logs` entry.

## 3. Test Runner Concept
The `firestore.rules.test.ts` will verify that all the above attempts return `PERMISSION_DENIED`.
