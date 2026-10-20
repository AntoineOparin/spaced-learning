# Decision records

Short notes on choices that shape the architecture. One file per decision, numbered in order.
Add a record when a change would surprise someone reading the code a year from now.

| # | Decision |
|---|---|
| [0001](0001-indexeddb-is-the-primary-store.md) | IndexedDB is the primary store; the server is a sync target |
| [0002](0002-generic-record-table-on-d1.md) | The server stores opaque client records with last-write-wins |
| [0003](0003-tombstones-and-append-only-logs.md) | Deletions are tombstones; review logs are append-only |
| [0004](0004-cloudflare-access-single-tenant.md) | Cloudflare Access is the auth boundary; the Worker re-verifies; one user |
| [0005](0005-wire-schema-version-and-clock-skew.md) | Sync records carry a schema version; clock skew is detected, not corrected |
