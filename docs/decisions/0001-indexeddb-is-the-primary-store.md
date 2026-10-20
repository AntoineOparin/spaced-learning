# 0001 — IndexedDB is the primary store; the server is a sync target

**Status:** accepted (2026-10)

## Context

The app is used on an iPhone during study, often offline, and must open instantly. It is also
a personal tool that should keep working if the hosting disappears.

## Decision

Every device keeps a complete copy of the data in IndexedDB (Dexie). All reads and writes are
local; the Worker + D1 copy exists only so devices can exchange changes and so a reinstalled
app can recover. The app never waits on the network to render or to record a review.

## Consequences

- The UI is reactive over local data (`useLiveQuery`); sync is a background concern.
- Every synced record carries `updatedAt`, `dirty` and an optional `deletedAt` so the client can
  compute deltas without server help.
- Schema changes need a Dexie version upgrade on every device, so record shapes change rarely
  and always additively where possible.
- A full backup is a plain export of the local tables, independent of the server.
