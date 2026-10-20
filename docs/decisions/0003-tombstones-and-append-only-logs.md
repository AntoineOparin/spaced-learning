# 0003 — Deletions are tombstones; review logs are append-only

**Status:** accepted (2026-10)

## Context

With last-write-wins sync, a hard delete on one device and an edit on another would resurrect
the record or lose the delete depending on timing. Review history is the most valuable data in
the app: it is what FSRS learns from and what any future optimiser needs.

## Decision

Synced records are never removed. Deleting sets `deletedAt` (and bumps `updatedAt`) so the
tombstone propagates like any other write; cascades (course → topics → items → cards) tombstone
each row. Review logs are only ever added; undoing a review tombstones its log rather than
deleting it. Reads filter with `alive()`.

## Consequences

- Nothing synced is lost silently; D1 Time Travel plus a device reset can recover from any
  mistake that has synced.
- Tables grow forever. At personal scale this is fine; a compaction step would need its own
  decision record.
- Every read path must remember to filter tombstones, which is why reads live in
  `src/db/queries.ts` and `src/db/hooks.ts`.
