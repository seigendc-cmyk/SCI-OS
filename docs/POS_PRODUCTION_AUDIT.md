# SCI POS Production Audit

This repository-level audit focuses on rebuilding SCI POS as the first production SaaS.

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

## Current Prototype Strengths
The existing prototype already contains valuable POS logic that should be preserved conceptually.

## Unsafe Prototype Logic to Replace
- Client-side sale finalization
- Direct Firestore writes for critical business records
- Non-atomic stock deduction
- Client-side COGS calculation
- Client-side approval trust
- Broad module drift

## Phase-by-Phase Rebuild Plan for SCI POS Only
Phase 1 — Production foundation
Phase 2 — POS setup
... (see full doc content in repository)

