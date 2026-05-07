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