# Database integration plan

Phase 0 intentionally does not initialize Prisma, connect PostgreSQL, or define business
tables. `DATABASE_URL` is reserved in `.env.example` only.

The backend phase will introduce PostgreSQL and Prisma after API ownership, idempotency,
server-authoritative rewards, immutable battle snapshots, and deletion requirements are
specified.
