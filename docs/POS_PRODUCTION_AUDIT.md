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
Expand docs/POS_PRODUCTION_AUDIT.md into a full SCI POS production audit.

Keep the SOT locked:
SCI POS is the first production SaaS. This repository is a prototype/reference app. Do not expand iTred, Market Space, PoolWise, iDeliver, CashPlan, RPN, or broad SCI OS modules until POS is production-ready.

Add these sections:

1. Current Prototype Strengths
2. Unsafe Prototype Logic to Replace
3. Production POS Data Model Proposal
4. Required Supabase/Postgres Tables
5. Required Postgres RPCs
6. Required RLS Policies
7. Required Audit/BI Event Vocabulary
8. Phase-by-Phase Rebuild Plan for SCI POS Only
9. What Must Not Be Built Until POS Is Live

Use the current repo as reference, especially:
- src/App.tsx POS routes
- src/pages/vendor/pos/*
- src/services/orderService.ts
- src/services/biService.ts
- firestore.rules

Do not change runtime code in this step. Documentation only.