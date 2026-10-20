# 0005 — Sync records carry a schema version; clock skew is detected, not corrected

**Status:** accepted (2026-10)

## Context

Decision 0002 makes the server schema-agnostic, which means nothing stops an old build from
pulling records written by a newer build and storing them unmigrated, or pushing stale shapes
over newer ones. Decision 0002 also resolves conflicts by `updatedAt`, which comes from each
device's wall clock; a wrong clock silently wins or loses every conflict.

## Decision

**Schema version.** `SCHEMA_VERSION` (`src/domain/types.ts`) equals the latest Dexie version.
Every push states it; the server stores it per row (`schema_version`), remembers the highest it
has seen (`meta.schemaVersion`), and refuses pushes from older clients with HTTP 426. On pull the
client refuses a page containing a newer version before writing anything (status `outdated`,
with an "update the app" prompt) and upgrades older rows through `RECORD_UPGRADES`
(`src/db/upgrades.ts`), the same functions a Dexie upgrade should call. Pulled records are also
validated against the Zod record schemas; unreadable ones are skipped and counted, and the
cursor still advances so one bad row can never wedge sync.

**Clock skew.** The server returns its time on every pull. The client records
`serverTime - Date.now()` and warns above five minutes; it does not adjust timestamps. It also
counts local unpushed edits that a newer remote record replaced and shows the number in
Settings.

## Consequences

- A release that changes a record shape bumps `SCHEMA_VERSION` and the Dexie version together,
  adds an upgrade entry, and runs the D1 migration before deploying the Worker.
- Devices on different app versions stop syncing until the older one updates; studying offline
  keeps working.
- A hybrid logical clock was considered and rejected for now: it would touch every write path
  and make `updatedAt` stop meaning wall time, for a conflict that a one-person setup rarely hits.
