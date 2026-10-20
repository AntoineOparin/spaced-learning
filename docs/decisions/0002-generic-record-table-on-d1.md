# 0002 — The server stores opaque client records with last-write-wins

**Status:** accepted (2026-10)

## Context

The server exists to relay changes between a handful of devices owned by one person. Giving it
knowledge of courses, cards and review logs would mean maintaining two schemas and two sets of
migrations for no query it ever needs to answer.

## Decision

D1 has one `records` table keyed by `(tbl, id)` holding the client record as JSON, its
`updated_at`, a `deleted` flag and a monotonic `seq`. Push is an upsert that keeps the row with
the greater `updated_at`; pull returns rows with `seq` greater than the device's cursor. The
client resolves conflicts the same way (newer `updatedAt` wins, review logs are a union).

## Consequences

- Adding a synced table or field needs no server change.
- Conflict resolution is coarse: two edits to the same record on two devices keep only the
  newer one. Acceptable for one person who rarely edits the same card on two devices at once.
- Ordering depends on device clocks (see 0005).
- The server validates only the envelope; the client validates record shapes on pull.
