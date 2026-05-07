# SCI POS Production Audit

## SOT Summary

SCI POS is the first production SaaS. This repository is currently a prototype/reference app. The production build must focus on POS only before expanding into the broader SCI Operating System.

Primary production direction:

- Next.js
- Supabase/Postgres
- Vercel
- RLS
- Postgres RPCs for sale finalization
- append-only audit and BI events
- tenant-scoped POS data
- server/database-controlled stock and cash movements

The current Vite/Firebase application must be treated as a feature reference and prototype archive. Production POS logic must be rebuilt with stronger database control, auditability, staff accountability, stock integrity, and Zimbabwe-ready transaction discipline.

---

## 1. Current Prototype Strengths

The existing prototype already contains valuable POS logic that should be preserved conceptually:

### 1.1 POS route coverage

The app already separates several POS areas:

- POS dashboard
- POS terminal
- shifts
- settings
- BI
- accounting
- reports
- customers
- customer accounts
- layby
- approvals
- returns
- sales history

This is useful as a feature map for the production POS.

### 1.2 Terminal and shift discipline

The terminal screen already thinks in terms of:

- selected terminal
- active shift
- branch
- cashier identity
- terminal access events
- shift detection

This direction must be preserved, but production must enforce it at database/RPC level.

### 1.3 Zero-stock blocking

The prototype blocks selling when stock is zero or insufficient. This is core to SCI POS.

Production must preserve this rule:

- no negative stock sales
- no silent stock deduction
- blocked sale attempts must create BI/audit events

### 1.4 Approval workflows

The prototype includes:

- price override requests
- discount approval requests
- pending approval monitoring
- owner immediate approval logic
- staff approval request logic

This is very important for Zimbabwean retail realities where staff accountability and theft prevention are central.

### 1.5 Sale modes

The prototype considers:

- cash sales
- credit sales
- layby sales

This is useful and should remain in the production model, but must be moved into controlled RPCs.

### 1.6 Inventory ledger thinking

The prototype creates inventory ledger records when stock is moved during a sale.

This is correct. Production must make the inventory ledger append-only and database-enforced.

### 1.7 COGS awareness

The prototype calculates COGS during sale finalization. This supports:

- gross profit reporting
- COGS reserve logic
- stock profitability
- anti-theft analysis

Production must formalize this into a reliable COGS capture mechanism.

### 1.8 BI event vocabulary

The prototype already includes a strong BI event vocabulary, including:

- sale completed
- zero-stock blocked
- shift opened
- shift closed
- cash variance
- price override
- refund request
- stocktake
- delivery
- OPEX leakage
- staff behaviour alert

This vocabulary should be carried forward into the production event model.

---

## 2. Unsafe Prototype Logic to Replace

The current implementation is useful for prototyping, but several areas are unsafe for production.

### 2.1 Client-side sale finalization

Sensitive sale finalization currently happens from frontend logic. Production must not allow the browser to directly control:

- final sale records
- stock deductions
- inventory ledger posting
- cash movements
- customer credit balances
- layby balances
- COGS postings
- accounting journal creation

These must move to Postgres RPC functions.

### 2.2 Direct Firestore writes for critical business records

The prototype writes many business records directly to Firestore collections from the client. Production must instead use:

- Supabase RLS
- Postgres functions
- transaction-safe RPCs
- append-only audit logs

### 2.3 Non-atomic stock deduction

Stock verification and stock deduction must be atomic. Production must prevent:

- two cashiers selling the same last item
- stock going negative due to race conditions
- sale record created without stock ledger
- stock ledger created without sale record

### 2.4 Client-side COGS calculation

The frontend should not be the final authority for COGS. Production should use database-side product cost snapshots at sale time.

### 2.5 Client-side approval trust

Approval workflows must be server-enforced. Production must prevent staff from bypassing approval screens and writing approved values directly.

### 2.6 Broad module drift

The prototype contains many modules beyond POS. These must not be expanded until POS is production-ready.

Out of scope for now:

- iTred expansion
- Market Space
- PoolWise
- iDeliver expansion
- CashPlan full module
- RPN commercial expansion
- full SCI OS console expansion

---

## 3. Production POS Data Model Proposal

Production SCI POS should use tenant-scoped tables with clear separation between setup, transactions, approvals, audit, BI, and accounting.

Core concepts:

- tenant = business/vendor
- branch = shop/location
- warehouse = stock holding location
- terminal = POS selling point
- shift = cashier cash-control session
- sale = completed or draft transaction
- inventory ledger = append-only stock movement
- cash movement = cash drawer/bank movement
- BI event = rule-driven intelligence signal
- audit event = immutable operational trace

---

## 4. Required Supabase/Postgres Tables

### Identity and tenancy

- tenants
- tenant_users
- platform_users
- roles
- permissions

### POS setup

- branches
- warehouses
- terminals
- terminal_assignments
- shifts
- shift_cash_counts

### Products and stock

- products
- product_stock_balances
- product_cost_layers
- inventory_ledger
- stocktake_sessions
- stocktake_lines
- stock_adjustment_requests

### Sales

- sales
- sale_items
- payments
- sale_discounts
- sale_price_overrides
- sale_status_history

### Customers and credit

- customers
- customer_accounts
- customer_ledger
- credit_terms
- credit_limit_reviews

### Layby

- layby_orders
- layby_items
- layby_payments
- layby_status_history

### Returns and refunds

- return_requests
- return_items
- refund_payments
- refund_approvals

### Approvals

- approval_requests
- approval_actions
- approval_rules

### Cash and accounting

- cash_movements
- cash_drawer_sessions
- chart_accounts
- journals
- journal_lines
- accounting_posting_batches

### BI and audit

- audit_events
- bi_events
- staff_risk_scores
- product_risk_scores
- stock_integrity_alerts
- system_health_events

---

## 5. Required Postgres RPCs

Critical POS actions must be performed through RPCs.

### Shift RPCs

- open_shift
- close_shift
- submit_shift_cash_count
- approve_shift_variance

### Sale RPCs

- create_sale_draft
- finalize_sale
- void_sale
- hold_sale
- resume_sale

### Approval RPCs

- request_price_override
- approve_price_override
- reject_price_override
- request_discount
- approve_discount
- reject_discount
- request_refund
- approve_refund
- reject_refund

### Stock RPCs

- post_inventory_adjustment
- run_spot_check
- submit_stocktake
- approve_stocktake_variance
- transfer_stock_between_locations

### Cash RPCs

- post_cash_movement
- cash_in
- cash_out
- bank_deposit
- record_cash_variance

### Accounting RPCs

- create_accounting_journal_draft
- post_accounting_journal
- validate_journal_balanced
- reverse_journal

### BI/audit RPCs

- log_bi_event
- log_audit_event
- recalculate_staff_risk_score
- recalculate_stock_integrity_score

---

## 6. Required RLS Policies

Production RLS must enforce strict tenant boundaries.

### General rules

- users can access only tenants where they are active members
- platform admins are separate from vendor users
- tenant staff cannot access other tenants
- public users cannot access POS transaction data

### Product/stock rules

- staff can read assigned products/stock
- staff cannot directly update stock balances
- stock movement must happen through RPCs
- inventory ledger must be append-only

### Sales rules

- cashiers can create sales only through authorized terminal and open shift
- no sale finalization without open shift
- no sale finalization without stock validation
- no direct sale total manipulation
- no delete of completed sales

### Approvals rules

- staff can request approvals
- only authorized owner/admin/manager can approve
- approval actions must be append-only
- rejected approvals cannot be reused

### Cash rules

- cashiers can submit cash counts
- cash drawer movements must be audited
- cash variances must create BI/audit events

### Audit and BI rules

- audit_events append-only
- bi_events append-only
- only authorized dashboards can read BI summaries
- raw logs must remain tenant-scoped

---

## 7. Required Audit/BI Event Vocabulary

Production SCI POS should preserve and formalize these events:

### Sale events

- POS_SALE_STARTED
- POS_SALE_DRAFT_CREATED
- POS_SALE_COMPLETED
- POS_SALE_VOID_REQUESTED
- POS_SALE_VOID_APPROVED
- POS_SALE_BLOCKED_ZERO_STOCK
- POS_SALE_BLOCKED_INSUFFICIENT_STOCK

### Shift events

- SHIFT_OPENED
- SHIFT_CLOSED
- SHIFT_CASH_COUNT_SUBMITTED
- CASH_VARIANCE_FOUND
- CASH_VARIANCE_APPROVED

### Approval events

- PRICE_OVERRIDE_REQUESTED
- PRICE_OVERRIDE_APPROVED
- PRICE_OVERRIDE_REJECTED
- DISCOUNT_REQUESTED
- DISCOUNT_APPROVED
- DISCOUNT_REJECTED
- REFUND_REQUESTED
- REFUND_APPROVED
- REFUND_REJECTED

### Stock events

- INVENTORY_LEDGER_POSTED
- STOCK_ADJUSTMENT_REQUESTED
- STOCK_ADJUSTMENT_APPROVED
- STOCKTAKE_SUBMITTED
- STOCKTAKE_VARIANCE_FOUND
- LOW_STOCK_REMINDER
- NON_MOVING_STOCK_DETECTED

### COGS/accounting events

- COGS_CAPTURED
- COGS_RESERVED
- ACCOUNTING_JOURNAL_DRAFTED
- ACCOUNTING_JOURNAL_POSTED
- DOUBLE_ENTRY_VALIDATION_FAILED

### Staff risk events

- FAILED_TERMINAL_LOGIN
- STAFF_BEHAVIOUR_ALERT
- REPEATED_OVERRIDE_REQUEST
- REPEATED_CASH_VARIANCE
- REPEATED_STOCK_VARIANCE

---

## 8. Phase-by-Phase Rebuild Plan for SCI POS Only

### Phase 1 — Production foundation

Build a clean Next.js + Supabase + Vercel foundation with:

- tenant model
- user roles
- Supabase Auth
- RLS
- audit event base
- POS-only navigation

### Phase 2 — POS setup

Build:

- branches
- warehouses
- terminals
- staff assignments
- terminal permissions
- shift open/close

### Phase 3 — Product and stock foundation

Build:

- products
- stock balances
- stock locations
- cost snapshots
- inventory ledger
- stock adjustment requests

### Phase 4 — POS terminal and sale finalization

Build:

- mobile-first POS terminal
- product search
- cart
- zero-stock blocking
- finalize_sale RPC
- sale_items
- payments
- inventory ledger posting

### Phase 5 — Shift and cash control

Build:

- opening float
- cash in/out
- closing count
- variance reporting
- owner approval
- cash drawer events

### Phase 6 — Approvals

Build:

- price override approval
- discount approval
- void approval
- refund approval
- approval request lifecycle

### Phase 7 — Credit and layby

Build:

- customer accounts
- credit sales
- customer ledger
- layby orders
- layby deposits
- layby balances

### Phase 8 — Returns/refunds

Build:

- return requests
- stock return logic
- refund approval
- audit and BI events

### Phase 9 — Lite accounting

Build:

- chart of accounts
- journal drafts
- journal lines
- sale accounting entries
- COGS entries
- cashbook/bankbook movement

### Phase 10 — BI and owner dashboard

Build:

- sales dashboard
- stock risk alerts
- staff risk signals
- variance alerts
- dead stock alerts
- anti-theft intelligence

### Phase 11 — VAT/tax/fiscal readiness

Build:

- VAT-ready transaction records
- tax report exports
- fiscal device/API placeholder
- Zimbabwe compliance readiness

---

## 9. What Must Not Be Built Until POS Is Live

Until SCI POS is production-ready, do not expand:

- iTred
- Market Space
- PoolWise
- iDeliver
- CashPlan full module
- RPN commercial expansion
- full SCI OS console
- full accounting suite
- AI-heavy Seith automation
- broad multi-module SCI OS workflows

These modules remain future SCI OS layers. The first production SaaS is SCI POS only.